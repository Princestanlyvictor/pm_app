from datetime import datetime, date
from typing import Any, Dict, List, Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.db import project_activities, project_docs, projects, reports, users
from app.deps import get_current_user
from app.rbac import append_audit_log, can_access_project, is_privileged_role, validate_users_exist

router = APIRouter(prefix="/projects", tags=["projects"])


def _to_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid ID format") from exc


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


def _get_member_role(project_doc: Dict[str, Any], user: Dict[str, Any]) -> Optional[str]:
    if is_privileged_role(user.get("role")):
        return "project_manager"

    user_email = str(user.get("email") or "").strip().lower()
    members = project_doc.get("members", [])
    for member in members:
        if str(member.get("email") or "").strip().lower() == user_email:
            return member.get("role", "viewer")

    if user_email in [str(email or "").strip().lower() for email in project_doc.get("team_members", [])]:
        return "developer"

    return None


def _require_project_access(project_doc: Dict[str, Any], user: Dict[str, Any]) -> str:
    if not can_access_project(project_doc, user):
        raise HTTPException(status_code=403, detail="You do not have access to this project")

    role = _get_member_role(project_doc, user)
    if role is None:
        # Non-member privileged users still need a role for downstream checks.
        return "project_manager"
    return role


def _require_pm_access(project_doc: Dict[str, Any], user: Dict[str, Any]) -> str:
    role = _require_project_access(project_doc, user)
    if role != "project_manager":
        raise HTTPException(status_code=403, detail="Only Project Managers can perform this action")
    return role


async def _log_activity(
    project_id: str,
    action: str,
    message: str,
    user: Dict[str, Any],
    metadata: Optional[Dict[str, Any]] = None,
):
    await project_activities.insert_one(
        {
            "project_id": project_id,
            "action": action,
            "message": message,
            "actor_email": user.get("email"),
            "actor_role": user.get("role"),
            "metadata": metadata or {},
            "created_at": datetime.utcnow(),
        }
    )


def _build_default_roadmap() -> Dict[str, Any]:
    names = ["Planning", "Design", "Development", "Testing", "Deployment"]
    return {
        "stages": [
            {
                "id": str(ObjectId()),
                "name": name,
                "description": "",
                "order": index + 1,
                "created_at": datetime.utcnow(),
            }
            for index, name in enumerate(names)
        ],
        "milestones": [],
    }


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    status: Literal["Active", "On Hold", "Completed"] = "Active"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    project_manager_email: Optional[str] = None
    team_members: List[str] = []
    repository_url: Optional[str] = None
    default_branch: str = "main"


class ProjectSettingsUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["Active", "On Hold", "Completed"]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class ProjectMemberAssign(BaseModel):
    email: str
    role: Literal["project_manager", "developer", "viewer"] = "developer"


class ProjectAssignmentsUpdate(BaseModel):
    team_members: List[str] = []


class StageCreate(BaseModel):
    name: str
    description: str = ""
    order: Optional[int] = None


class MilestoneCreate(BaseModel):
    name: str
    stage_id: Optional[str] = None
    deadline: Optional[str] = None
    description: str = ""
    status: Literal["planned", "in_progress", "completed"] = "planned"


class MilestoneUpdate(BaseModel):
    status: Optional[Literal["planned", "in_progress", "completed"]] = None
    deadline: Optional[str] = None


class RepositoryUpdate(BaseModel):
    repo_url: str
    default_branch: str = "main"


class ProjectDocCreate(BaseModel):
    title: str
    content: str
    version: str = "v1"


class ProjectDocUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    version: Optional[str] = None


@router.post("")
async def create_project(payload: ProjectCreate, user=Depends(get_current_user)):
    if not is_privileged_role(user.get("role")):
        raise HTTPException(status_code=403, detail="Only project managers can create projects")

    existing = await projects.find_one({"name": payload.name})
    if existing:
        raise HTTPException(status_code=400, detail="Project with this name already exists")

    normalized_team_members = [str(email).strip().lower() for email in payload.team_members if str(email).strip()]
    await validate_users_exist(normalized_team_members)

    member_map: Dict[str, str] = {str(user["email"]).strip().lower(): "project_manager"}
    if payload.project_manager_email:
        member_map[str(payload.project_manager_email).strip().lower()] = "project_manager"
    for member_email in normalized_team_members:
        member_map.setdefault(member_email, "developer")

    members = [
        {
            "email": email,
            "role": role,
            "added_at": datetime.utcnow(),
            "added_by": user.get("email"),
        }
        for email, role in member_map.items()
    ]

    now = datetime.utcnow()
    doc = {
        "name": payload.name,
        "description": payload.description,
        "status": payload.status,
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "project_manager_email": payload.project_manager_email or user.get("email"),
        "team_members": [m.get("email") for m in members if m.get("role") != "project_manager"],
        "members": members,
        "repository": {
            "repo_url": payload.repository_url or "",
            "default_branch": payload.default_branch,
            "updated_at": now,
        },
        "roadmap": _build_default_roadmap(),
        "created_by": user.get("email"),
        "created_by_id": user.get("id"),
        "created_at": now,
        "updated_at": now,
        "updated_by": user.get("email"),
    }

    result = await projects.insert_one(doc)
    project_id = str(result.inserted_id)

    await _log_activity(
        project_id,
        "project_created",
        f"Project '{payload.name}' created",
        user,
        {"status": payload.status, "team_members": doc.get("team_members", [])},
    )
    await append_audit_log(
        "project_created",
        user,
        "project",
        project_id,
        {"name": payload.name, "team_members": doc.get("team_members", [])},
    )

    return {
        "id": project_id,
        "name": payload.name,
        "description": payload.description,
        "status": payload.status,
        "message": "Project created successfully",
    }


@router.get("")
async def list_projects(user=Depends(get_current_user)):
    query: Dict[str, Any] = {}
    if not is_privileged_role(user.get("role")):
        query = {
            "$or": [
                {"members.email": str(user.get("email") or "").strip().lower()},
                {"team_members": str(user.get("email") or "").strip().lower()},
            ]
        }

    all_projects = await projects.find(query).sort("name", 1).to_list(None)
    return [
        {
            "id": str(project["_id"]),
            "name": project.get("name"),
            "description": project.get("description"),
            "status": project.get("status", "Active"),
            "start_date": project.get("start_date"),
            "end_date": project.get("end_date"),
            "project_manager_email": project.get("project_manager_email"),
            "team_members": project.get("team_members", []),
            "members_count": len(project.get("members", [])),
            "created_by": project.get("created_by"),
            "created_at": project.get("created_at"),
        }
        for project in all_projects
    ]


@router.get("/by-name/{project_name}")
async def get_project_by_name(project_name: str, user=Depends(get_current_user)):
    project = await projects.find_one({"name": project_name})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    _require_project_access(project, user)
    payload = _serialize(project)
    payload["id"] = payload.pop("_id")
    return payload


@router.get("/{project_id}")
async def get_project(project_id: str, user=Depends(get_current_user)):
    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    role = _require_project_access(project, user)
    payload = _serialize(project)
    payload["id"] = payload.pop("_id")
    payload["user_project_role"] = role
    return payload


@router.patch("/{project_id}/settings")
async def update_project_settings(project_id: str, payload: ProjectSettingsUpdate, user=Depends(get_current_user)):
    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    _require_pm_access(project, user)

    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update fields provided")

    if "name" in update_data:
        normalized_name = str(update_data["name"]).strip()
        if not normalized_name:
            raise HTTPException(status_code=400, detail="Project name cannot be empty")

        duplicate = await projects.find_one({"name": normalized_name, "_id": {"$ne": project["_id"]}})
        if duplicate:
            raise HTTPException(status_code=400, detail="Project with this name already exists")

        update_data["name"] = normalized_name

    update_data["updated_at"] = datetime.utcnow()
    update_data["updated_by"] = user.get("email")
    await projects.update_one({"_id": project["_id"]}, {"$set": update_data})

    await _log_activity(
        project_id,
        "project_settings_updated",
        "Project settings updated",
        user,
        {"fields": list(update_data.keys())},
    )
    await append_audit_log(
        "project_settings_updated",
        user,
        "project",
        project_id,
        {"fields": list(update_data.keys())},
    )

    return {"status": "Project settings updated"}


@router.delete("/{project_id}")
async def delete_project(project_id: str, user=Depends(get_current_user)):
    if not is_privileged_role(user.get("role")):
        raise HTTPException(status_code=403, detail="Only admins can delete projects")

    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await projects.delete_one({"_id": project["_id"]})
    await reports.delete_many({"type": "TASK", "project_id": project_id})
    await project_docs.delete_many({"project_id": project_id})

    await _log_activity(project_id, "project_deleted", f"Project '{project.get('name')}' deleted", user)
    await append_audit_log(
        "project_deleted",
        user,
        "project",
        project_id,
        {"name": project.get("name")},
    )

    return {"status": "Project deleted"}


@router.get("/{project_id}/members")
async def get_project_members(project_id: str, user=Depends(get_current_user)):
    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    _require_project_access(project, user)
    members = project.get("members", [])

    workload_counts: Dict[str, int] = {}
    task_rows = await reports.find({"type": "TASK", "project_id": project_id}).to_list(None)
    for task in task_rows:
        owners = task.get("assigned_to") or [task.get("user_email") or task.get("created_by")]
        for owner in owners:
            if owner:
                workload_counts[owner] = workload_counts.get(owner, 0) + 1

    return [
        {
            **_serialize(member),
            "workload": workload_counts.get(member.get("email"), 0),
        }
        for member in members
    ]


@router.post("/{project_id}/members")
async def assign_project_member(project_id: str, payload: ProjectMemberAssign, user=Depends(get_current_user)):
    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    _require_pm_access(project, user)

    normalized_email = str(payload.email).strip().lower()

    existing_user = await users.find_one({"email": normalized_email})
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")

    members = project.get("members", [])
    updated = False
    for member in members:
        if str(member.get("email") or "").strip().lower() == normalized_email:
            member["role"] = payload.role
            member["updated_at"] = datetime.utcnow()
            member["updated_by"] = user.get("email")
            updated = True
            break

    if not updated:
        members.append(
            {
                "email": normalized_email,
                "role": payload.role,
                "added_at": datetime.utcnow(),
                "added_by": user.get("email"),
            }
        )

    team_members = [m.get("email") for m in members if m.get("role") != "project_manager"]
    await projects.update_one(
        {"_id": project["_id"]},
        {
            "$set": {
                "members": members,
                "team_members": team_members,
                "updated_at": datetime.utcnow(),
                "updated_by": user.get("email"),
            }
        },
    )

    await _log_activity(
        project_id,
        "member_added_or_updated",
        f"Member {normalized_email} assigned role {payload.role}",
        user,
        {"member": normalized_email, "role": payload.role},
    )
    await append_audit_log(
        "project_member_updated",
        user,
        "project",
        project_id,
        {"member": normalized_email, "role": payload.role},
    )

    return {"status": "Member assignment updated"}


@router.put("/{project_id}/assignments")
async def update_project_assignments(project_id: str, payload: ProjectAssignmentsUpdate, user=Depends(get_current_user)):
    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    _require_pm_access(project, user)

    team_members = [str(email).strip().lower() for email in payload.team_members if str(email).strip()]
    await validate_users_exist(team_members)

    members = [member for member in (project.get("members", []) or []) if member.get("role") == "project_manager"]
    now = datetime.utcnow()
    existing_pm_emails = {str(member.get("email") or "").strip().lower() for member in members}
    project_manager_email = str(project.get("project_manager_email") or "").strip().lower()
    if project_manager_email and project_manager_email not in existing_pm_emails:
        members.append(
            {
                "email": project_manager_email,
                "role": "project_manager",
                "added_at": now,
                "added_by": "system_sync",
            }
        )

    members.extend(
        {
            "email": email,
            "role": "developer",
            "added_at": now,
            "added_by": user.get("email"),
        }
        for email in team_members
    )

    await projects.update_one(
        {"_id": project["_id"]},
        {
            "$set": {
                "members": members,
                "team_members": team_members,
                "updated_at": now,
                "updated_by": user.get("email"),
                "legacy_visibility": "assigned",
            }
        },
    )

    await _log_activity(
        project_id,
        "project_assignments_updated",
        "Project team assignments updated",
        user,
        {"team_members": team_members},
    )
    await append_audit_log(
        "project_assignments_updated",
        user,
        "project",
        project_id,
        {"team_members": team_members},
    )

    return {"status": "Project assignments updated", "team_members": team_members}


@router.get("/{project_id}/workspace")
async def get_project_workspace(project_id: str, user=Depends(get_current_user)):
    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    role = _require_project_access(project, user)

    task_query: Dict[str, Any] = {"type": "TASK", "project_id": project_id}
    if not is_privileged_role(user.get("role")):
        task_query["assigned_to"] = str(user.get("email") or "").strip().lower()
    task_rows = await reports.find(task_query).to_list(None)
    today = date.today()
    total_tasks = len(task_rows)
    completed = len([task for task in task_rows if str(task.get("status", "")).lower() in ["done", "completed"]])
    pending = len([task for task in task_rows if str(task.get("status", "")).lower() not in ["done", "completed"]])

    overdue = 0
    blocked_tasks = []
    workload: Dict[str, int] = {}
    for task in task_rows:
        due_value = task.get("due_date") or task.get("task_date")
        if due_value and str(task.get("status", "")).lower() not in ["done", "completed"]:
            try:
                if datetime.fromisoformat(str(due_value)).date() < today:
                    overdue += 1
            except ValueError:
                pass

        unresolved_dependencies = [
            dependency
            for dependency in task.get("dependencies", [])
            if dependency not in task.get("resolved_dependencies", [])
        ]
        if unresolved_dependencies or str(task.get("status", "")).lower() == "blocked":
            blocked_tasks.append(
                {
                    "id": str(task.get("_id")),
                    "title": task.get("title"),
                    "unresolved_dependencies": unresolved_dependencies,
                }
            )

        owners = task.get("assigned_to") or [task.get("user_email") or task.get("created_by")]
        for owner in owners:
            if owner:
                workload[owner] = workload.get(owner, 0) + 1

    activities = await project_activities.find({"project_id": project_id}).sort("created_at", -1).limit(20).to_list(None)

    return {
        "project": {
            "id": str(project.get("_id")),
            "name": project.get("name"),
            "description": project.get("description"),
            "status": project.get("status", "Active"),
            "start_date": project.get("start_date"),
            "end_date": project.get("end_date"),
            "project_manager_email": project.get("project_manager_email"),
        },
        "user_project_role": role,
        "stats": {
            "total_tasks": total_tasks,
            "completed_tasks": completed,
            "pending_tasks": pending,
            "overdue_tasks": overdue,
            "blocked_tasks": len(blocked_tasks),
            "progress_percent": int((completed / total_tasks) * 100) if total_tasks else 0,
        },
        "members": _serialize(project.get("members", [])),
        "workload_distribution": [{"email": email, "task_count": count} for email, count in workload.items()],
        "blocked_tasks": blocked_tasks,
        "recent_activity": _serialize(activities),
    }


@router.get("/{project_id}/tasks")
async def get_project_tasks(
    project_id: str,
    status: Optional[str] = Query(default=None),
    assignee: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    stage: Optional[str] = Query(default=None),
    view: Literal["list", "kanban"] = Query(default="list"),
    user=Depends(get_current_user),
):
    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_project_access(project, user)

    query: Dict[str, Any] = {"type": "TASK", "project_id": project_id}
    if not is_privileged_role(user.get("role")):
        query["assigned_to"] = str(user.get("email") or "").strip().lower()
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if stage:
        query["stage"] = stage
    if assignee:
        normalized_assignee = str(assignee).strip().lower()
        if not is_privileged_role(user.get("role")) and normalized_assignee != str(user.get("email") or "").strip().lower():
            raise HTTPException(status_code=403, detail="Team members can only filter by themselves")
        query["$or"] = [
            {"user_email": normalized_assignee},
            {"assigned_to": normalized_assignee},
            {"dependencies": assignee},
            {"created_by": assignee},
        ]

    task_rows = await reports.find(query).sort("created_at", -1).to_list(None)
    items = [
        {
            "id": str(task.get("_id")),
            "project_id": task.get("project_id"),
            "title": task.get("title"),
            "description": task.get("description"),
            "status": task.get("status"),
            "priority": task.get("priority"),
            "stage": task.get("stage"),
            "task_date": task.get("task_date"),
            "due_date": task.get("due_date") or task.get("task_date"),
            "estimated_time": task.get("estimated_time"),
            "dependencies": task.get("dependencies", []),
            "resolved_dependencies": task.get("resolved_dependencies", []),
            "assigned_to": task.get("assigned_to", []),
            "created_by": task.get("created_by"),
            "updated_at": task.get("updated_at"),
        }
        for task in task_rows
    ]

    if view == "kanban":
        grouped: Dict[str, List[Dict[str, Any]]] = {"To Do": [], "In Progress": [], "Done": []}
        for item in items:
            grouped.setdefault(item.get("status") or "To Do", []).append(item)
        return {"view": "kanban", "items": grouped}

    return {"view": "list", "items": items}


@router.get("/{project_id}/roadmap")
async def get_project_roadmap(project_id: str, user=Depends(get_current_user)):
    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_project_access(project, user)

    roadmap = project.get("roadmap") or _build_default_roadmap()
    stages = roadmap.get("stages", [])
    task_query: Dict[str, Any] = {"type": "TASK", "project_id": project_id}
    if not is_privileged_role(user.get("role")):
        task_query["assigned_to"] = str(user.get("email") or "").strip().lower()
    task_rows = await reports.find(task_query).to_list(None)

    stage_progress = []
    for stage in stages:
        stage_name = stage.get("name")
        stage_id = stage.get("id")
        stage_tasks = [
            task
            for task in task_rows
            if task.get("stage") in [stage_name, stage_id]
        ]
        done_count = len([task for task in stage_tasks if str(task.get("status", "")).lower() in ["done", "completed"]])
        total_count = len(stage_tasks)
        stage_progress.append(
            {
                **_serialize(stage),
                "task_count": total_count,
                "completed_count": done_count,
                "progress_percent": int((done_count / total_count) * 100) if total_count else 0,
            }
        )

    return {
        "stages": stage_progress,
        "milestones": _serialize(roadmap.get("milestones", [])),
    }


@router.post("/{project_id}/roadmap/stages")
async def add_roadmap_stage(project_id: str, payload: StageCreate, user=Depends(get_current_user)):
    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_pm_access(project, user)

    roadmap = project.get("roadmap") or _build_default_roadmap()
    stages = roadmap.get("stages", [])
    stage_doc = {
        "id": str(ObjectId()),
        "name": payload.name,
        "description": payload.description,
        "order": payload.order if payload.order is not None else (len(stages) + 1),
        "created_at": datetime.utcnow(),
    }
    stages.append(stage_doc)
    roadmap["stages"] = stages

    await projects.update_one(
        {"_id": project["_id"]},
        {"$set": {"roadmap": roadmap, "updated_at": datetime.utcnow(), "updated_by": user.get("email")}},
    )

    await _log_activity(project_id, "stage_added", f"Roadmap stage '{payload.name}' added", user)
    return {"status": "Stage added", "stage": _serialize(stage_doc)}


@router.post("/{project_id}/roadmap/milestones")
async def add_roadmap_milestone(project_id: str, payload: MilestoneCreate, user=Depends(get_current_user)):
    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_pm_access(project, user)

    roadmap = project.get("roadmap") or _build_default_roadmap()
    milestone = {
        "id": str(ObjectId()),
        "name": payload.name,
        "stage_id": payload.stage_id,
        "deadline": payload.deadline,
        "description": payload.description,
        "status": payload.status,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    roadmap.setdefault("milestones", []).append(milestone)

    await projects.update_one(
        {"_id": project["_id"]},
        {"$set": {"roadmap": roadmap, "updated_at": datetime.utcnow(), "updated_by": user.get("email")}},
    )
    await _log_activity(project_id, "milestone_added", f"Milestone '{payload.name}' added", user)
    return {"status": "Milestone added", "milestone": _serialize(milestone)}


@router.patch("/{project_id}/roadmap/milestones/{milestone_id}")
async def update_roadmap_milestone(
    project_id: str,
    milestone_id: str,
    payload: MilestoneUpdate,
    user=Depends(get_current_user),
):
    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_pm_access(project, user)

    roadmap = project.get("roadmap") or _build_default_roadmap()
    milestones = roadmap.get("milestones", [])

    found = False
    for milestone in milestones:
        if milestone.get("id") == milestone_id:
            for key, value in payload.model_dump().items():
                if value is not None:
                    milestone[key] = value
            milestone["updated_at"] = datetime.utcnow()
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Milestone not found")

    roadmap["milestones"] = milestones
    await projects.update_one(
        {"_id": project["_id"]},
        {"$set": {"roadmap": roadmap, "updated_at": datetime.utcnow(), "updated_by": user.get("email")}},
    )

    await _log_activity(
        project_id,
        "milestone_updated",
        f"Milestone '{milestone_id}' updated",
        user,
        payload.model_dump(exclude_none=True),
    )
    return {"status": "Milestone updated"}


@router.get("/{project_id}/repository")
async def get_project_repository(project_id: str, user=Depends(get_current_user)):
    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_project_access(project, user)
    return _serialize(project.get("repository", {"repo_url": "", "default_branch": "main"}))


@router.patch("/{project_id}/repository")
async def update_project_repository(project_id: str, payload: RepositoryUpdate, user=Depends(get_current_user)):
    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_pm_access(project, user)

    repository = {
        "repo_url": payload.repo_url,
        "default_branch": payload.default_branch,
        "updated_at": datetime.utcnow(),
        "updated_by": user.get("email"),
    }
    await projects.update_one(
        {"_id": project["_id"]},
        {"$set": {"repository": repository, "updated_at": datetime.utcnow(), "updated_by": user.get("email")}},
    )
    await _log_activity(project_id, "repository_updated", "Repository settings updated", user, repository)
    return {"status": "Repository updated", "repository": _serialize(repository)}


@router.get("/{project_id}/docs")
async def get_project_docs(project_id: str, user=Depends(get_current_user)):
    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_project_access(project, user)

    docs = await project_docs.find({"project_id": project_id}).sort("updated_at", -1).to_list(None)
    return [_serialize(doc) for doc in docs]


@router.post("/{project_id}/docs")
async def create_project_doc(project_id: str, payload: ProjectDocCreate, user=Depends(get_current_user)):
    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    role = _require_project_access(project, user)
    if role == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot create documentation")

    now = datetime.utcnow()
    doc = {
        "project_id": project_id,
        "title": payload.title,
        "content": payload.content,
        "version": payload.version,
        "last_updated_by": user.get("email"),
        "created_at": now,
        "updated_at": now,
    }
    result = await project_docs.insert_one(doc)
    await _log_activity(project_id, "doc_created", f"Document '{payload.title}' created", user)
    return {"id": str(result.inserted_id), "status": "Document created"}


@router.put("/{project_id}/docs/{doc_id}")
async def update_project_doc(
    project_id: str,
    doc_id: str,
    payload: ProjectDocUpdate,
    user=Depends(get_current_user),
):
    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    role = _require_project_access(project, user)
    if role == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot edit documentation")

    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update fields provided")

    update_data["last_updated_by"] = user.get("email")
    update_data["updated_at"] = datetime.utcnow()

    result = await project_docs.update_one(
        {"_id": _to_object_id(doc_id), "project_id": project_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")

    await _log_activity(
        project_id,
        "doc_updated",
        f"Document '{doc_id}' updated",
        user,
        {"fields": list(update_data.keys())},
    )
    return {"status": "Document updated"}


@router.get("/{project_id}/activity")
async def get_project_activity(project_id: str, user=Depends(get_current_user)):
    project = await projects.find_one({"_id": _to_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_project_access(project, user)

    activities = await project_activities.find({"project_id": project_id}).sort("created_at", -1).limit(100).to_list(None)
    return [_serialize(activity) for activity in activities]
