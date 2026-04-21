import os
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.db import daily_plans, projects, reports, users, work_blocks
from app.deps import get_current_user

router = APIRouter(prefix="/daily-plans", tags=["daily-plans"])

DEFAULT_AVAILABLE_MINUTES = int(float(os.getenv("DAILY_AVAILABLE_HOURS", "8")) * 60)
DEFAULT_WORKDAY_START_HOUR = int(os.getenv("WORKDAY_START_HOUR", "9"))
DEFAULT_TASK_PROGRESS_BASE_MINUTES = int(float(os.getenv("TASK_PROGRESS_FALLBACK_HOURS", "8")) * 60)


def _to_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid ID format") from exc


def _parse_day(value: Optional[str]) -> str:
    if not value:
        return date.today().isoformat()
    try:
        parsed = date.fromisoformat(value)
        return parsed.isoformat()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD") from exc


def _to_minutes(hhmm: str) -> int:
    try:
        hours_str, minutes_str = hhmm.split(":")
        hours = int(hours_str)
        minutes = int(minutes_str)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM") from exc

    if hours < 0 or hours > 23 or minutes < 0 or minutes > 59:
        raise HTTPException(status_code=400, detail="Invalid time value")

    return hours * 60 + minutes


def _from_minutes(value: int) -> str:
    hours = value // 60
    minutes = value % 60
    return f"{hours:02d}:{minutes:02d}"


def _serialize(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [_serialize(v) for v in value]
    if isinstance(value, dict):
        return {k: _serialize(v) for k, v in value.items()}
    return value


def _normalize_estimated_minutes(payload_estimated_minutes: Optional[int], start_minutes: int, end_minutes: int) -> int:
    if payload_estimated_minutes is not None:
        if payload_estimated_minutes <= 0:
            raise HTTPException(status_code=400, detail="ETA must be greater than 0 minutes")
        return payload_estimated_minutes
    return max(end_minutes - start_minutes, 1)


def _validate_time_window(start_minutes: int, end_minutes: int):
    if end_minutes <= start_minutes:
        raise HTTPException(status_code=400, detail="End time must be after start time")


async def _get_or_create_daily_plan(user: Dict[str, Any], plan_date: str) -> Dict[str, Any]:
    existing = await daily_plans.find_one({"user_email": user.get("email"), "date": plan_date})
    if existing:
        return existing

    now = datetime.utcnow()
    doc = {
        "user_id": user.get("id"),
        "user_email": user.get("email"),
        "date": plan_date,
        "available_minutes": DEFAULT_AVAILABLE_MINUTES,
        "total_planned_minutes": 0,
        "total_actual_minutes": 0,
        "status": "planned",
        "created_at": now,
        "updated_at": now,
    }
    result = await daily_plans.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def _get_task_or_404(task_id: str) -> Dict[str, Any]:
    task = await reports.find_one({"_id": _to_object_id(task_id), "type": "TASK"})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


async def _is_project_member(project_id: Optional[str], user_email: str) -> bool:
    if not project_id:
        return False

    project = await projects.find_one(
        {
            "_id": _to_object_id(project_id),
            "$or": [
                {"members.email": user_email},
                {"team_members": user_email},
                {"created_by": user_email},
                {"project_manager_email": user_email},
            ],
        },
        {"_id": 1},
    )
    return project is not None


async def _can_user_link_task(task_doc: Dict[str, Any], user_email: str) -> bool:
    assigned_to = task_doc.get("assigned_to", []) or []
    if isinstance(assigned_to, str):
        assigned_to = [assigned_to]

    if (
        task_doc.get("user_email") == user_email
        or task_doc.get("created_by") == user_email
        or user_email in assigned_to
    ):
        return True

    return await _is_project_member(task_doc.get("project_id"), user_email)


async def _get_project_name_map(project_ids: List[str]) -> Dict[str, str]:
    clean_ids = []
    for project_id in project_ids:
        if not project_id:
            continue
        try:
            clean_ids.append(_to_object_id(project_id))
        except HTTPException:
            continue

    if not clean_ids:
        return {}

    rows = await projects.find({"_id": {"$in": clean_ids}}, {"name": 1}).to_list(None)
    return {str(row.get("_id")): row.get("name", str(row.get("_id"))) for row in rows}


async def _get_candidate_tasks_by_project_membership(user_email: str) -> List[Dict[str, Any]]:
    accessible_projects = await projects.find(
        {
            "$or": [
                {"members.email": user_email},
                {"team_members": user_email},
                {"created_by": user_email},
                {"project_manager_email": user_email},
            ]
        },
        {"_id": 1},
    ).to_list(None)

    project_ids = [str(project.get("_id")) for project in accessible_projects if project.get("_id")]
    if not project_ids:
        return []

    return await reports.find({"type": "TASK", "project_id": {"$in": project_ids}}).sort("updated_at", -1).to_list(200)


async def _ensure_block_no_overlap(
    user_email: str,
    block_date: str,
    start_minutes: int,
    end_minutes: int,
    excluded_block_id: Optional[str] = None,
):
    query: Dict[str, Any] = {"user_email": user_email, "date": block_date}
    if excluded_block_id:
        query["_id"] = {"$ne": _to_object_id(excluded_block_id)}

    existing_blocks = await work_blocks.find(query).to_list(None)
    for block in existing_blocks:
        existing_start = block.get("start_minutes", 0)
        existing_end = block.get("end_minutes", 0)
        if start_minutes < existing_end and end_minutes > existing_start:
            raise HTTPException(
                status_code=400,
                detail=f"Time overlap detected with block {block.get('start_time')} - {block.get('end_time')}",
            )


async def _recalculate_plan_totals(plan_id: ObjectId) -> Dict[str, int]:
    blocks = await work_blocks.find({"daily_plan_id": str(plan_id)}).to_list(None)
    total_planned = sum(int(block.get("estimated_minutes", 0) or 0) for block in blocks)
    total_actual = sum(int(block.get("actual_minutes", 0) or 0) for block in blocks)

    status = "planned"
    if blocks and all((block.get("eod_status") in ["completed", "partially_completed", "not_done"]) for block in blocks):
        status = "completed"

    await daily_plans.update_one(
        {"_id": plan_id},
        {
            "$set": {
                "total_planned_minutes": total_planned,
                "total_actual_minutes": total_actual,
                "status": status,
                "updated_at": datetime.utcnow(),
            }
        },
    )

    return {"total_planned_minutes": total_planned, "total_actual_minutes": total_actual}


def _build_alerts(available_minutes: int, total_planned_minutes: int, blocks: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    alerts: List[Dict[str, str]] = []

    if not blocks:
        alerts.append({"type": "missing_plan", "message": "No work blocks planned for today."})
    if total_planned_minutes < available_minutes:
        alerts.append(
            {
                "type": "under_planned",
                "message": f"Planned time is below target by {(available_minutes - total_planned_minutes)} minutes.",
            }
        )
    if total_planned_minutes > available_minutes:
        alerts.append(
            {
                "type": "over_planned",
                "message": f"Planned time exceeds target by {(total_planned_minutes - available_minutes)} minutes.",
            }
        )

    for block in blocks:
        estimated = int(block.get("estimated_minutes", 0) or 0)
        actual = int(block.get("actual_minutes", 0) or 0)
        if estimated > 0 and actual > estimated:
            alerts.append(
                {
                    "type": "eta_exceeded",
                    "message": f"Task '{block.get('task_title', 'Task')}' exceeded ETA by {actual - estimated} minutes.",
                }
            )

    return alerts


def _build_timeline(blocks: List[Dict[str, Any]], available_minutes: int) -> List[Dict[str, Any]]:
    timeline: List[Dict[str, Any]] = []
    day_start = DEFAULT_WORKDAY_START_HOUR * 60
    day_end = day_start + available_minutes

    sorted_blocks = sorted(blocks, key=lambda block: block.get("start_minutes", 0))
    cursor = day_start

    for block in sorted_blocks:
        block_start = block.get("start_minutes", 0)
        block_end = block.get("end_minutes", 0)

        if block_start > cursor:
            timeline.append(
                {
                    "type": "gap",
                    "from": _from_minutes(cursor),
                    "to": _from_minutes(block_start),
                    "minutes": block_start - cursor,
                }
            )

        timeline.append(
            {
                "type": "work_block",
                "id": str(block.get("_id")),
                "task_id": block.get("task_id"),
                "task_title": block.get("task_title"),
                "sub_task": block.get("sub_task"),
                "from": block.get("start_time"),
                "to": block.get("end_time"),
                "status": block.get("status", "planned"),
                "estimated_minutes": block.get("estimated_minutes", 0),
                "actual_minutes": block.get("actual_minutes", 0),
            }
        )

        cursor = max(cursor, block_end)

    if cursor < day_end:
        timeline.append(
            {
                "type": "gap",
                "from": _from_minutes(cursor),
                "to": _from_minutes(day_end),
                "minutes": day_end - cursor,
            }
        )

    return timeline


async def _sync_task_progress(task_id: str):
    task = await reports.find_one({"_id": _to_object_id(task_id), "type": "TASK"})
    if not task:
        return

    all_blocks = await work_blocks.find({"task_id": task_id}).to_list(None)
    task_actual_minutes = sum(int(block.get("actual_minutes", 0) or 0) for block in all_blocks)

    estimated_hours = task.get("estimated_time")
    if isinstance(estimated_hours, (int, float)) and estimated_hours > 0:
        denominator_minutes = int(estimated_hours * 60)
    else:
        denominator_minutes = DEFAULT_TASK_PROGRESS_BASE_MINUTES

    progress_percent = 0
    if denominator_minutes > 0:
        progress_percent = min(100, int(round((task_actual_minutes / denominator_minutes) * 100)))

    updated_status = task.get("status") or "To Do"
    if progress_percent >= 100:
        updated_status = "Done"
    elif task_actual_minutes > 0 and updated_status in ["To Do", "Pending"]:
        updated_status = "In Progress"

    await reports.update_one(
        {"_id": task["_id"]},
        {
            "$set": {
                "progress_percent": progress_percent,
                "actual_minutes": task_actual_minutes,
                "status": updated_status,
                "updated_at": datetime.utcnow(),
            }
        },
    )


async def _get_my_plannable_tasks(user_email: str) -> List[Dict[str, Any]]:
    task_rows = await reports.find(
        {
            "type": "TASK",
            "$or": [
                {"user_email": user_email},
                {"created_by": user_email},
                {"assigned_to": user_email},
            ],
        }
    ).sort("updated_at", -1).to_list(200)

    if not task_rows:
        task_rows = await _get_candidate_tasks_by_project_membership(user_email)

    filtered_tasks: List[Dict[str, Any]] = []
    for task in task_rows:
        if await _can_user_link_task(task, user_email):
            filtered_tasks.append(task)

    project_name_map = await _get_project_name_map([task.get("project_id") for task in filtered_tasks])

    payload = []
    for task in filtered_tasks:
        project_id = task.get("project_id")
        payload.append(
            {
                "id": str(task.get("_id")),
                "project_id": project_id,
                "project_name": project_name_map.get(project_id, project_id),
                "title": task.get("title"),
                "status": task.get("status"),
                "priority": task.get("priority"),
                "estimated_time": task.get("estimated_time"),
                "progress_percent": task.get("progress_percent", 0),
            }
        )
    return payload


class WorkBlockCreateRequest(BaseModel):
    task_id: str
    project_id: str
    sub_task: Optional[str] = ""
    start_time: str
    end_time: str
    estimated_minutes: Optional[int] = Field(default=None, ge=1)


class WorkBlockUpdateRequest(BaseModel):
    sub_task: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    estimated_minutes: Optional[int] = Field(default=None, ge=1)
    status: Optional[Literal["planned", "in_progress", "completed", "delayed", "paused"]] = None


class EodUpdateRequest(BaseModel):
    eod_status: Literal["completed", "partially_completed", "not_done"]
    actual_minutes: int = Field(ge=0)
    delay_reason: Optional[str] = ""


class PlanCapacityUpdateRequest(BaseModel):
    available_minutes: int = Field(ge=60, le=24 * 60)


@router.get("/me")
async def get_or_create_my_plan(
    date_value: Optional[str] = Query(default=None, alias="date"),
    user=Depends(get_current_user),
):
    plan_date = _parse_day(date_value)
    plan = await _get_or_create_daily_plan(user, plan_date)

    blocks = await work_blocks.find({"daily_plan_id": str(plan["_id"])}).sort("start_minutes", 1).to_list(None)
    totals = await _recalculate_plan_totals(plan["_id"])

    plan = await daily_plans.find_one({"_id": plan["_id"]})
    available_minutes = int(plan.get("available_minutes", DEFAULT_AVAILABLE_MINUTES))
    alerts = _build_alerts(available_minutes, totals["total_planned_minutes"], blocks)
    timeline = _build_timeline(blocks, available_minutes)

    return {
        "plan": {
            "id": str(plan.get("_id")),
            "user_id": plan.get("user_id"),
            "user_email": plan.get("user_email"),
            "date": plan.get("date"),
            "available_minutes": available_minutes,
            "total_planned_minutes": totals["total_planned_minutes"],
            "total_actual_minutes": totals["total_actual_minutes"],
            "status": plan.get("status", "planned"),
        },
        "work_blocks": _serialize(blocks),
        "timeline": timeline,
        "alerts": alerts,
        "plannable_tasks": await _get_my_plannable_tasks(user.get("email")),
    }


@router.patch("/me/capacity")
async def update_my_capacity(payload: PlanCapacityUpdateRequest, date_value: Optional[str] = Query(default=None, alias="date"), user=Depends(get_current_user)):
    plan_date = _parse_day(date_value)
    plan = await _get_or_create_daily_plan(user, plan_date)

    await daily_plans.update_one(
        {"_id": plan["_id"]},
        {"$set": {"available_minutes": payload.available_minutes, "updated_at": datetime.utcnow()}},
    )

    return {"status": "Capacity updated", "available_minutes": payload.available_minutes}


@router.post("/me/blocks")
async def add_work_block(payload: WorkBlockCreateRequest, date_value: Optional[str] = Query(default=None, alias="date"), user=Depends(get_current_user)):
    plan_date = _parse_day(date_value)
    plan = await _get_or_create_daily_plan(user, plan_date)

    task_doc = await _get_task_or_404(payload.task_id)
    if not await _can_user_link_task(task_doc, user.get("email")):
        raise HTTPException(status_code=403, detail="You can only plan blocks on your assigned tasks")

    start_minutes = _to_minutes(payload.start_time)
    end_minutes = _to_minutes(payload.end_time)
    _validate_time_window(start_minutes, end_minutes)

    await _ensure_block_no_overlap(user.get("email"), plan_date, start_minutes, end_minutes)

    estimated_minutes = _normalize_estimated_minutes(payload.estimated_minutes, start_minutes, end_minutes)

    current_blocks = await work_blocks.find({"daily_plan_id": str(plan["_id"])}).to_list(None)
    current_total_planned = sum(int(block.get("estimated_minutes", 0) or 0) for block in current_blocks)
    available_minutes = int(plan.get("available_minutes", DEFAULT_AVAILABLE_MINUTES))
    if current_total_planned + estimated_minutes > available_minutes:
        exceeded_by = (current_total_planned + estimated_minutes) - available_minutes
        raise HTTPException(
            status_code=400,
            detail=f"Planned time exceeds daily capacity by {exceeded_by} minutes",
        )

    now = datetime.utcnow()
    block_doc = {
        "daily_plan_id": str(plan["_id"]),
        "date": plan_date,
        "user_id": user.get("id"),
        "user_email": user.get("email"),
        "project_id": payload.project_id,
        "task_id": payload.task_id,
        "task_title": task_doc.get("title"),
        "sub_task": payload.sub_task or "",
        "start_time": payload.start_time,
        "end_time": payload.end_time,
        "start_minutes": start_minutes,
        "end_minutes": end_minutes,
        "estimated_minutes": estimated_minutes,
        "actual_minutes": 0,
        "tracked_minutes": 0,
        "status": "planned",
        "eod_status": None,
        "delay_reason": "",
        "timer_started_at": None,
        "created_at": now,
        "updated_at": now,
    }

    result = await work_blocks.insert_one(block_doc)
    await _recalculate_plan_totals(plan["_id"])

    return {
        "id": str(result.inserted_id),
        "status": "Work block created",
    }


@router.put("/me/blocks/{block_id}")
async def update_work_block(block_id: str, payload: WorkBlockUpdateRequest, user=Depends(get_current_user)):
    block = await work_blocks.find_one({"_id": _to_object_id(block_id), "user_email": user.get("email")})
    if not block:
        raise HTTPException(status_code=404, detail="Work block not found")

    start_minutes = block.get("start_minutes")
    end_minutes = block.get("end_minutes")

    if payload.start_time is not None:
        start_minutes = _to_minutes(payload.start_time)
    if payload.end_time is not None:
        end_minutes = _to_minutes(payload.end_time)

    _validate_time_window(start_minutes, end_minutes)
    await _ensure_block_no_overlap(user.get("email"), block.get("date"), start_minutes, end_minutes, excluded_block_id=block_id)

    estimated_minutes = block.get("estimated_minutes")
    if payload.estimated_minutes is not None:
        estimated_minutes = payload.estimated_minutes
    if estimated_minutes is None:
        estimated_minutes = _normalize_estimated_minutes(None, start_minutes, end_minutes)

    plan = await daily_plans.find_one({"_id": _to_object_id(block.get("daily_plan_id"))})
    plan_blocks = await work_blocks.find({"daily_plan_id": block.get("daily_plan_id")}).to_list(None)

    total_without_this = sum(
        int(item.get("estimated_minutes", 0) or 0)
        for item in plan_blocks
        if str(item.get("_id")) != block_id
    )

    available_minutes = int((plan or {}).get("available_minutes", DEFAULT_AVAILABLE_MINUTES))
    if total_without_this + int(estimated_minutes) > available_minutes:
        exceeded_by = (total_without_this + int(estimated_minutes)) - available_minutes
        raise HTTPException(status_code=400, detail=f"Planned time exceeds daily capacity by {exceeded_by} minutes")

    update_fields: Dict[str, Any] = {
        "start_minutes": start_minutes,
        "end_minutes": end_minutes,
        "estimated_minutes": int(estimated_minutes),
        "updated_at": datetime.utcnow(),
    }

    if payload.sub_task is not None:
        update_fields["sub_task"] = payload.sub_task
    if payload.start_time is not None:
        update_fields["start_time"] = payload.start_time
    else:
        update_fields["start_time"] = block.get("start_time")
    if payload.end_time is not None:
        update_fields["end_time"] = payload.end_time
    else:
        update_fields["end_time"] = block.get("end_time")
    if payload.status is not None:
        update_fields["status"] = payload.status

    await work_blocks.update_one({"_id": block["_id"]}, {"$set": update_fields})
    await _recalculate_plan_totals(_to_object_id(block.get("daily_plan_id")))

    return {"status": "Work block updated"}


@router.delete("/me/blocks/{block_id}")
async def delete_work_block(block_id: str, user=Depends(get_current_user)):
    block = await work_blocks.find_one({"_id": _to_object_id(block_id), "user_email": user.get("email")})
    if not block:
        raise HTTPException(status_code=404, detail="Work block not found")

    await work_blocks.delete_one({"_id": block["_id"]})
    await _recalculate_plan_totals(_to_object_id(block.get("daily_plan_id")))
    await _sync_task_progress(block.get("task_id"))

    return {"status": "Work block deleted"}


async def _pause_timer_if_running(block: Dict[str, Any]) -> Dict[str, Any]:
    timer_started_at = block.get("timer_started_at")
    if not timer_started_at:
        return block

    now = datetime.utcnow()
    elapsed = now - timer_started_at
    elapsed_minutes = max(int(elapsed.total_seconds() // 60), 0)

    tracked_minutes = int(block.get("tracked_minutes", 0) or 0) + elapsed_minutes
    actual_minutes = max(int(block.get("actual_minutes", 0) or 0), tracked_minutes)

    await work_blocks.update_one(
        {"_id": block["_id"]},
        {
            "$set": {
                "tracked_minutes": tracked_minutes,
                "actual_minutes": actual_minutes,
                "timer_started_at": None,
                "updated_at": now,
            }
        },
    )

    block["tracked_minutes"] = tracked_minutes
    block["actual_minutes"] = actual_minutes
    block["timer_started_at"] = None
    return block


@router.post("/me/blocks/{block_id}/start")
async def start_work_block(block_id: str, user=Depends(get_current_user)):
    block = await work_blocks.find_one({"_id": _to_object_id(block_id), "user_email": user.get("email")})
    if not block:
        raise HTTPException(status_code=404, detail="Work block not found")

    if block.get("timer_started_at") is not None:
        raise HTTPException(status_code=400, detail="Timer already running")

    await work_blocks.update_one(
        {"_id": block["_id"]},
        {
            "$set": {
                "status": "in_progress",
                "timer_started_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        },
    )

    return {"status": "Timer started"}


@router.post("/me/blocks/{block_id}/pause")
async def pause_work_block(block_id: str, user=Depends(get_current_user)):
    block = await work_blocks.find_one({"_id": _to_object_id(block_id), "user_email": user.get("email")})
    if not block:
        raise HTTPException(status_code=404, detail="Work block not found")

    block = await _pause_timer_if_running(block)

    await work_blocks.update_one(
        {"_id": block["_id"]},
        {"$set": {"status": "paused", "updated_at": datetime.utcnow()}},
    )

    await _recalculate_plan_totals(_to_object_id(block.get("daily_plan_id")))
    await _sync_task_progress(block.get("task_id"))

    return {"status": "Timer paused", "tracked_minutes": block.get("tracked_minutes", 0)}


@router.post("/me/blocks/{block_id}/resume")
async def resume_work_block(block_id: str, user=Depends(get_current_user)):
    block = await work_blocks.find_one({"_id": _to_object_id(block_id), "user_email": user.get("email")})
    if not block:
        raise HTTPException(status_code=404, detail="Work block not found")

    if block.get("timer_started_at") is not None:
        raise HTTPException(status_code=400, detail="Timer already running")

    await work_blocks.update_one(
        {"_id": block["_id"]},
        {
            "$set": {
                "status": "in_progress",
                "timer_started_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        },
    )

    return {"status": "Timer resumed"}


@router.post("/me/blocks/{block_id}/complete")
async def complete_work_block(block_id: str, user=Depends(get_current_user)):
    block = await work_blocks.find_one({"_id": _to_object_id(block_id), "user_email": user.get("email")})
    if not block:
        raise HTTPException(status_code=404, detail="Work block not found")

    block = await _pause_timer_if_running(block)

    actual_minutes = int(block.get("actual_minutes", 0) or 0)
    if actual_minutes == 0:
        actual_minutes = int(block.get("estimated_minutes", 0) or 0)

    await work_blocks.update_one(
        {"_id": block["_id"]},
        {
            "$set": {
                "status": "completed",
                "eod_status": "completed",
                "actual_minutes": actual_minutes,
                "updated_at": datetime.utcnow(),
            }
        },
    )

    await _recalculate_plan_totals(_to_object_id(block.get("daily_plan_id")))
    await _sync_task_progress(block.get("task_id"))

    return {"status": "Work block completed"}


@router.post("/me/blocks/{block_id}/eod")
async def update_work_block_eod(block_id: str, payload: EodUpdateRequest, user=Depends(get_current_user)):
    block = await work_blocks.find_one({"_id": _to_object_id(block_id), "user_email": user.get("email")})
    if not block:
        raise HTTPException(status_code=404, detail="Work block not found")

    block = await _pause_timer_if_running(block)

    mapped_status = "completed" if payload.eod_status == "completed" else "delayed"

    await work_blocks.update_one(
        {"_id": block["_id"]},
        {
            "$set": {
                "eod_status": payload.eod_status,
                "status": mapped_status,
                "actual_minutes": payload.actual_minutes,
                "delay_reason": payload.delay_reason or "",
                "updated_at": datetime.utcnow(),
            }
        },
    )

    plan_id = _to_object_id(block.get("daily_plan_id"))
    totals = await _recalculate_plan_totals(plan_id)
    await _sync_task_progress(block.get("task_id"))

    variance = payload.actual_minutes - int(block.get("estimated_minutes", 0) or 0)

    return {
        "status": "EOD update recorded",
        "planned_minutes": int(block.get("estimated_minutes", 0) or 0),
        "actual_minutes": payload.actual_minutes,
        "variance_minutes": variance,
        "plan_totals": totals,
    }


@router.get("/me/alerts")
async def get_my_alerts(date_value: Optional[str] = Query(default=None, alias="date"), user=Depends(get_current_user)):
    plan_date = _parse_day(date_value)
    plan = await _get_or_create_daily_plan(user, plan_date)
    blocks = await work_blocks.find({"daily_plan_id": str(plan["_id"])}).to_list(None)

    totals = await _recalculate_plan_totals(plan["_id"])
    available_minutes = int(plan.get("available_minutes", DEFAULT_AVAILABLE_MINUTES))

    return {
        "date": plan_date,
        "alerts": _build_alerts(available_minutes, totals["total_planned_minutes"], blocks),
    }


@router.get("/me/weekly-insights")
async def get_weekly_insights(week_start: Optional[str] = Query(default=None), user=Depends(get_current_user)):
    if week_start:
        start_day = date.fromisoformat(week_start)
    else:
        today = date.today()
        start_day = today - timedelta(days=today.weekday())

    week_dates = [(start_day + timedelta(days=offset)).isoformat() for offset in range(7)]
    plans = await daily_plans.find({"user_email": user.get("email"), "date": {"$in": week_dates}}).to_list(None)

    if not plans:
        return {
            "week_start": start_day.isoformat(),
            "week_end": (start_day + timedelta(days=6)).isoformat(),
            "utilization_percent": 0,
            "estimation_accuracy_percent": 0,
            "consistent_overrun_days": [],
            "underutilized_days": week_dates,
        }

    total_available = sum(int(plan.get("available_minutes", DEFAULT_AVAILABLE_MINUTES)) for plan in plans)
    total_actual = sum(int(plan.get("total_actual_minutes", 0) or 0) for plan in plans)
    total_planned = sum(int(plan.get("total_planned_minutes", 0) or 0) for plan in plans)

    utilization_percent = int(round((total_actual / total_available) * 100)) if total_available else 0
    estimation_accuracy_percent = int(round((min(total_planned, total_actual) / max(total_planned, total_actual)) * 100)) if total_planned and total_actual else 0

    consistent_overrun_days = [
        plan.get("date")
        for plan in plans
        if int(plan.get("total_actual_minutes", 0) or 0) > int(plan.get("total_planned_minutes", 0) or 0)
    ]

    underutilized_days = [
        plan.get("date")
        for plan in plans
        if int(plan.get("total_planned_minutes", 0) or 0) < int(plan.get("available_minutes", DEFAULT_AVAILABLE_MINUTES))
    ]

    return {
        "week_start": start_day.isoformat(),
        "week_end": (start_day + timedelta(days=6)).isoformat(),
        "utilization_percent": utilization_percent,
        "estimation_accuracy_percent": estimation_accuracy_percent,
        "consistent_overrun_days": consistent_overrun_days,
        "underutilized_days": underutilized_days,
    }


@router.get("/manager/summary")
async def get_manager_summary(
    date_value: Optional[str] = Query(default=None, alias="date"),
    project_id: Optional[str] = Query(default=None),
    user=Depends(get_current_user),
):
    if user.get("role") not in ["admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Only managers can access this dashboard")

    plan_date = _parse_day(date_value)

    plan_query: Dict[str, Any] = {"date": plan_date}
    plans = await daily_plans.find(plan_query).to_list(None)

    user_rows = await users.find({"role": "team_member"}).to_list(None)
    all_team_member_emails = [u.get("email") for u in user_rows if u.get("email")]

    plan_map = {plan.get("user_email"): plan for plan in plans}

    member_rows = []
    total_planned = 0
    total_actual = 0
    total_completed_blocks = 0
    total_blocks = 0
    delay_reasons: List[Dict[str, str]] = []

    for email in all_team_member_emails:
        plan = plan_map.get(email)
        if not plan:
            member_rows.append(
                {
                    "user_email": email,
                    "has_plan": False,
                    "planned_minutes": 0,
                    "actual_minutes": 0,
                    "variance_minutes": 0,
                    "over_utilized": False,
                    "under_utilized": True,
                    "completed_blocks": 0,
                    "pending_blocks": 0,
                    "delay_reasons": [],
                }
            )
            continue

        block_query: Dict[str, Any] = {"daily_plan_id": str(plan.get("_id"))}
        if project_id:
            block_query["project_id"] = project_id

        blocks = await work_blocks.find(block_query).to_list(None)

        planned_minutes = sum(int(block.get("estimated_minutes", 0) or 0) for block in blocks)
        actual_minutes = sum(int(block.get("actual_minutes", 0) or 0) for block in blocks)
        completed_blocks = len([block for block in blocks if block.get("eod_status") == "completed"])
        pending_blocks = len([block for block in blocks if block.get("eod_status") != "completed"])

        reasons = [
            {
                "task_title": block.get("task_title", "Task"),
                "reason": block.get("delay_reason"),
            }
            for block in blocks
            if block.get("delay_reason")
        ]

        delay_reasons.extend(
            [{"user_email": email, "task_title": r["task_title"], "reason": r["reason"]} for r in reasons]
        )

        available_minutes = int(plan.get("available_minutes", DEFAULT_AVAILABLE_MINUTES))
        member_rows.append(
            {
                "user_email": email,
                "has_plan": True,
                "planned_minutes": planned_minutes,
                "actual_minutes": actual_minutes,
                "variance_minutes": actual_minutes - planned_minutes,
                "over_utilized": actual_minutes > available_minutes,
                "under_utilized": planned_minutes < available_minutes,
                "completed_blocks": completed_blocks,
                "pending_blocks": pending_blocks,
                "delay_reasons": reasons,
            }
        )

        total_planned += planned_minutes
        total_actual += actual_minutes
        total_completed_blocks += completed_blocks
        total_blocks += len(blocks)

    return {
        "date": plan_date,
        "members": member_rows,
        "team_summary": {
            "total_team_members": len(all_team_member_emails),
            "total_planned_minutes": total_planned,
            "total_actual_minutes": total_actual,
            "variance_minutes": total_actual - total_planned,
            "completed_blocks": total_completed_blocks,
            "pending_blocks": max(total_blocks - total_completed_blocks, 0),
            "completion_rate_percent": int(round((total_completed_blocks / total_blocks) * 100)) if total_blocks else 0,
        },
        "delay_reasons": delay_reasons,
    }


@router.get("/manager/user/{member_email}")
async def get_member_timeline_for_manager(
    member_email: str,
    date_value: Optional[str] = Query(default=None, alias="date"),
    user=Depends(get_current_user),
):
    if user.get("role") not in ["admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Only managers can access this dashboard")

    plan_date = _parse_day(date_value)
    plan = await daily_plans.find_one({"user_email": member_email, "date": plan_date})
    if not plan:
        return {
            "date": plan_date,
            "user_email": member_email,
            "plan": None,
            "work_blocks": [],
            "timeline": [],
            "alerts": [{"type": "missing_plan", "message": "User has not planned the day."}],
        }

    blocks = await work_blocks.find({"daily_plan_id": str(plan.get("_id"))}).sort("start_minutes", 1).to_list(None)
    totals = await _recalculate_plan_totals(plan.get("_id"))
    available_minutes = int(plan.get("available_minutes", DEFAULT_AVAILABLE_MINUTES))

    return {
        "date": plan_date,
        "user_email": member_email,
        "plan": {
            "id": str(plan.get("_id")),
            "available_minutes": available_minutes,
            "total_planned_minutes": totals.get("total_planned_minutes", 0),
            "total_actual_minutes": totals.get("total_actual_minutes", 0),
            "status": plan.get("status", "planned"),
        },
        "work_blocks": _serialize(blocks),
        "timeline": _build_timeline(blocks, available_minutes),
        "alerts": _build_alerts(available_minutes, totals.get("total_planned_minutes", 0), blocks),
    }
