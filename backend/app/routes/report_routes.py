from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId
from typing import List, Optional

from app.deps import get_current_user
from app.db import project_activities, projects, reports, users

router = APIRouter(prefix="/reports", tags=["reports"])


async def _log_task_activity(project_id: str, action: str, message: str, user: dict, metadata: Optional[dict] = None):
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


class MOMRequest(BaseModel):
    project_id: str
    date: str
    content: str


class TaskRequest(BaseModel):
    project_id: str
    title: str
    description: str
    status: str = "To Do"  # To Do, In Progress, Done
    priority: str = "Medium"  # Low, Medium, High
    stage: Optional[str] = None
    task_date: str  # YYYY-MM-DD format
    due_date: Optional[str] = None
    scheduled_start_time: Optional[str] = None  # Start time HH:MM format (00:00 - 23:59)
    scheduled_end_time: Optional[str] = None  # End time HH:MM format (00:00 - 23:59)
    estimated_time: Optional[int] = None  # in hours
    dependencies: Optional[List[str]] = None  # list of tagged user emails
    assigned_to: Optional[List[str]] = None  # list of user emails


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    stage: Optional[str] = None
    due_date: Optional[str] = None
    estimated_time: Optional[int] = None
    dependencies: Optional[List[str]] = None
    assigned_to: Optional[List[str]] = None


class ChatRequest(BaseModel):
    task_id: str
    message: str


@router.post("/mom")
async def create_mom(payload: MOMRequest, user=Depends(get_current_user)):
    doc = {
        "type": "MOM",
        "project_id": payload.project_id,
        "date": payload.date,
        "content": payload.content,
        "user_id": user["id"],
        "user_email": user["email"],
        "created_at": datetime.utcnow()
    }
    result = await reports.insert_one(doc)
    return {"id": str(result.inserted_id), "status": "MOM submitted"}


@router.post("/task")
async def create_task(payload: TaskRequest, user=Depends(get_current_user)):
    try:
        project_object_id = ObjectId(payload.project_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid project ID") from exc

    project = await projects.find_one({"_id": project_object_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    stage_value = payload.stage
    if not stage_value:
        default_stages = (project.get("roadmap") or {}).get("stages", [])
        if default_stages:
            stage_value = default_stages[0].get("name")

    doc = {
        "type": "TASK",
        "project_id": payload.project_id,
        "title": payload.title,
        "description": payload.description,
        "status": payload.status,
        "priority": payload.priority,
        "stage": stage_value,
        "task_date": payload.task_date,
        "due_date": payload.due_date or payload.task_date,
        "scheduled_start_time": payload.scheduled_start_time,  # Store start time HH:MM
        "scheduled_end_time": payload.scheduled_end_time,      # Store end time HH:MM
        "estimated_time": payload.estimated_time,
        "dependencies": payload.dependencies or [],
        "resolved_dependencies": [],  # Track which dependencies have been resolved
        "assigned_to": payload.assigned_to or [],
        "user_id": user["id"],
        "user_email": user["email"],
        "created_by": user["email"],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "chat": []
    }
    result = await reports.insert_one(doc)

    await _log_task_activity(
        payload.project_id,
        "task_created",
        f"Task '{payload.title}' created",
        user,
        {
            "task_id": str(result.inserted_id),
            "status": payload.status,
            "priority": payload.priority,
            "stage": stage_value,
        },
    )

    return {"id": str(result.inserted_id), "status": "Task submitted"}


@router.put("/task/{task_id}")
async def update_task(task_id: str, payload: TaskUpdateRequest, user=Depends(get_current_user)):
    task = await reports.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = {}
    
    if payload.title is not None:
        update_data["title"] = payload.title
    if payload.description is not None:
        update_data["description"] = payload.description
    if payload.status is not None:
        update_data["status"] = payload.status
    if payload.priority is not None:
        update_data["priority"] = payload.priority
    if payload.stage is not None:
        update_data["stage"] = payload.stage
    if payload.due_date is not None:
        update_data["due_date"] = payload.due_date
    if payload.estimated_time is not None:
        update_data["estimated_time"] = payload.estimated_time
    if payload.dependencies is not None:
        update_data["dependencies"] = payload.dependencies
    if payload.assigned_to is not None:
        update_data["assigned_to"] = payload.assigned_to
    
    update_data["updated_at"] = datetime.utcnow()
    
    await reports.update_one({"_id": ObjectId(task_id)}, {"$set": update_data})

    await _log_task_activity(
        task.get("project_id"),
        "task_updated",
        f"Task '{task.get('title', task_id)}' updated",
        user,
        {"task_id": task_id, "fields": list(update_data.keys())},
    )
    
    return {"id": task_id, "status": "Task updated"}


@router.post("/task/{task_id}/chat")
async def add_chat_to_task(task_id: str, payload: ChatRequest, user=Depends(get_current_user)):
    chat_message = {
        "user_email": user["email"],
        "message": payload.message,
        "timestamp": datetime.utcnow()
    }
    
    result = await reports.update_one(
        {"_id": ObjectId(task_id)},
        {"$push": {"chat": chat_message}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"status": "Message added"}


@router.get("/task/{task_id}")
async def get_task_detail(task_id: str, user=Depends(get_current_user)):
    task = await reports.find_one({"_id": ObjectId(task_id)})
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {
        "id": str(task["_id"]),
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
        "chat": task.get("chat", []),
        "created_at": task.get("created_at"),
        "updated_at": task.get("updated_at")
    }


@router.get("/tasks/{project_id}/by-date")
async def get_tasks_by_date(project_id: str, date: str, user=Depends(get_current_user)):
    """Get all tasks for a project on a specific date, grouped by team member"""
    tasks = await reports.find(
        {"project_id": project_id, "type": "TASK", "task_date": date}
    ).to_list(None)
    
    # Group tasks by user
    grouped_tasks = {}
    for task in tasks:
        user_email = task.get("user_email", "Unknown")
        if user_email not in grouped_tasks:
            grouped_tasks[user_email] = []
        
        grouped_tasks[user_email].append({
            "id": str(task["_id"]),
            "title": task.get("title"),
            "description": task.get("description"),
            "status": task.get("status"),
            "priority": task.get("priority"),
            "stage": task.get("stage"),
            "estimated_time": task.get("estimated_time"),
            "dependencies": task.get("dependencies", []),
            "assigned_to": task.get("assigned_to", []),
            "created_by": task.get("created_by"),
            "task_date": task.get("task_date"),
            "due_date": task.get("due_date") or task.get("task_date"),
            "created_at": task.get("created_at")
        })
    
    return grouped_tasks


@router.get("/tasks/{project_id}")
async def get_project_tasks(project_id: str, user=Depends(get_current_user)):
    tasks = await reports.find(
        {"project_id": project_id, "type": "TASK"}
    ).to_list(None)
    
    # Group tasks by user
    grouped_tasks = {}
    for task in tasks:
        user_email = task.get("user_email", "Unknown")
        if user_email not in grouped_tasks:
            grouped_tasks[user_email] = []
        
        grouped_tasks[user_email].append({
            "id": str(task["_id"]),
            "title": task.get("title"),
            "description": task.get("description"),
            "status": task.get("status"),
            "priority": task.get("priority"),
            "stage": task.get("stage"),
            "estimated_time": task.get("estimated_time"),
            "dependencies": task.get("dependencies", []),
            "assigned_to": task.get("assigned_to", []),
            "created_by": task.get("created_by"),
            "task_date": task.get("task_date"),
            "due_date": task.get("due_date") or task.get("task_date"),
            "created_at": task.get("created_at")
        })
    
    return grouped_tasks


@router.get("/moms/{project_id}")
async def get_project_moms(project_id: str, user=Depends(get_current_user)):
    moms = await reports.find(
        {"project_id": project_id, "type": "MOM"}
    ).to_list(None)
    
    return [{
        "id": str(mom["_id"]),
        "date": mom.get("date"),
        "content": mom.get("content"),
        "user_email": mom.get("user_email"),
        "created_at": mom.get("created_at")
    } for mom in moms]


@router.get("/user-tasks")
async def get_user_tasks(user=Depends(get_current_user)):
    tasks = await reports.find(
        {"user_id": user["id"], "type": "TASK"}
    ).sort("task_date", -1).to_list(None)
    
    return [{
        "id": str(task["_id"]),
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
        "created_at": task.get("created_at")
    } for task in tasks]


@router.get("/all-tasks")
async def get_all_tasks(user=Depends(get_current_user)):
    """Get all tasks in the system (for viewing tasks where user is tagged as dependency)"""
    tasks = await reports.find(
        {"type": "TASK"}
    ).sort("task_date", -1).to_list(None)
    
    return [{
        "id": str(task["_id"]),
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
        "created_at": task.get("created_at")
    } for task in tasks]


@router.get("/team-members/{project_id}")
async def get_team_members(project_id: str, user=Depends(get_current_user)):
    """Get all team members who have submitted tasks for a project"""
    tasks = await reports.find(
        {"project_id": project_id, "type": "TASK"}
    ).to_list(None)
    
    # Get unique team members
    team_members = {}
    for task in tasks:
        user_email = task.get("user_email", "Unknown")
        if user_email not in team_members:
            team_members[user_email] = {
                "email": user_email,
                "user_id": task.get("user_id"),
                "task_count": 0
            }
        team_members[user_email]["task_count"] += 1
    
    return list(team_members.values())


@router.get("/tasks/{project_id}/by-member/{member_email}")
async def get_member_tasks_by_date(project_id: str, member_email: str, user=Depends(get_current_user)):
    """Get all tasks for a specific team member in a project, grouped by date"""
    tasks = await reports.find(
        {"project_id": project_id, "type": "TASK", "user_email": member_email}
    ).sort("task_date", -1).to_list(None)
    
    # Group tasks by date
    grouped_tasks = {}
    for task in tasks:
        task_date = task.get("task_date", "No Date")
        if task_date not in grouped_tasks:
            grouped_tasks[task_date] = []
        
        grouped_tasks[task_date].append({
            "id": str(task["_id"]),
            "title": task.get("title"),
            "description": task.get("description"),
            "status": task.get("status"),
            "priority": task.get("priority"),
            "stage": task.get("stage"),
            "estimated_time": task.get("estimated_time"),
            "dependencies": task.get("dependencies", []),
            "assigned_to": task.get("assigned_to", []),
            "created_by": task.get("created_by"),
            "task_date": task.get("task_date"),
            "due_date": task.get("due_date") or task.get("task_date"),
            "created_at": task.get("created_at")
        })
    
    return grouped_tasks


@router.get("/tasks/by-member/{member_email}")
async def get_member_tasks_all_projects(member_email: str, user=Depends(get_current_user)):
    """Get all tasks for a specific team member across all projects, grouped by date"""
    tasks = await reports.find(
        {"type": "TASK", "user_email": member_email}
    ).sort("task_date", -1).to_list(None)

    grouped_tasks = {}
    for task in tasks:
        task_date = task.get("task_date", "No Date")
        if task_date not in grouped_tasks:
            grouped_tasks[task_date] = []

        grouped_tasks[task_date].append({
            "id": str(task["_id"]),
            "title": task.get("title"),
            "description": task.get("description"),
            "status": task.get("status"),
            "priority": task.get("priority"),
            "stage": task.get("stage"),
            "estimated_time": task.get("estimated_time"),
            "dependencies": task.get("dependencies", []),
            "assigned_to": task.get("assigned_to", []),
            "created_by": task.get("created_by"),
            "task_date": task.get("task_date"),
            "due_date": task.get("due_date") or task.get("task_date"),
            "project_id": task.get("project_id"),
            "created_at": task.get("created_at")
        })

    return grouped_tasks


@router.get("/tasks/today/breakdown")
async def get_today_tasks_breakdown(user=Depends(get_current_user)):
    """Get all tasks for today grouped by team member with status breakdown"""
    from datetime import datetime
    today = datetime.utcnow().date().isoformat()
    
    tasks = await reports.find(
        {"type": "TASK", "task_date": today}
    ).to_list(None)
    
    # Group by member email
    breakdown = {}
    for task in tasks:
        member_email = task.get("user_email", "Unknown")
        if member_email not in breakdown:
            breakdown[member_email] = {
                "email": member_email,
                "user_id": task.get("user_id"),
                "total_tasks": 0,
                "status_counts": {"To Do": 0, "In Progress": 0, "Done": 0},
                "priority_counts": {"Low": 0, "Medium": 0, "High": 0},
                "tasks": []
            }
        
        breakdown[member_email]["total_tasks"] += 1
        status = task.get("status", "To Do")
        breakdown[member_email]["status_counts"][status] = breakdown[member_email]["status_counts"].get(status, 0) + 1
        priority = task.get("priority", "Medium")
        breakdown[member_email]["priority_counts"][priority] = breakdown[member_email]["priority_counts"].get(priority, 0) + 1
        
        breakdown[member_email]["tasks"].append({
            "id": str(task["_id"]),
            "title": task.get("title"),
            "status": status,
            "priority": priority,
            "stage": task.get("stage"),
            "project_id": task.get("project_id")
        })
    
    return list(breakdown.values())


@router.get("/tasks/hourly-breakdown/{project_id}")
async def get_hourly_breakdown(
    project_id: str, 
    date: str, 
    start_hour: int = 0,  # Default 0 (midnight)
    end_hour: int = 24,   # Default 24 (end of day)
    user=Depends(get_current_user)
):
    """Get tasks scheduled for specific date grouped by custom hour range, including multi-hour tasks"""
    # Validate hour range
    start_hour = max(0, min(start_hour, 23))
    end_hour = max(start_hour + 1, min(end_hour, 24))
    
    tasks = await reports.find(
        {"project_id": project_id, "type": "TASK", "task_date": date, "user_id": user["id"]}
    ).to_list(None)
    
    # Initialize hourly breakdown with custom hour range
    hourly_breakdown = {}
    for hour in range(start_hour, end_hour):
        hour_end = hour + 1
        if hour_end > 23:
            hour_end = 23
        
        # Format time display
        start_ampm = "AM" if hour < 12 else "PM"
        end_ampm = "AM" if hour_end < 12 else "PM"
        start_12 = 12 if hour % 12 == 0 else hour % 12
        end_12 = 12 if hour_end % 12 == 0 else hour_end % 12
        
        time_slot = f"{start_12}:00 {start_ampm} - {end_12}:00 {end_ampm}"
        
        hourly_breakdown[hour] = {
            "hour": hour,
            "time_slot": time_slot,
            "tasks": []
        }
    
    # Add tasks to their scheduled times (tasks can span multiple hours/minutes)
    for task in tasks:
        task_start_time = task.get("scheduled_start_time")
        task_end_time = task.get("scheduled_end_time")
        
        # Parse times in HH:MM format
        if task_start_time and task_end_time:
            try:
                start_parts = task_start_time.split(':')
                end_parts = task_end_time.split(':')
                
                start_hour_val = int(start_parts[0])
                start_min_val = int(start_parts[1]) if len(start_parts) > 1 else 0
                end_hour_val = int(end_parts[0])
                end_min_val = int(end_parts[1]) if len(end_parts) > 1 else 0
                
                # Convert to minutes for accurate duration calculation
                start_minutes = start_hour_val * 60 + start_min_val
                end_minutes = end_hour_val * 60 + end_min_val
                
                if end_minutes <= start_minutes:
                    end_minutes += 24 * 60  # Next day if end < start
                
                duration_minutes = end_minutes - start_minutes
                
                task_data = {
                    "id": str(task["_id"]),
                    "title": task.get("title"),
                    "description": task.get("description"),
                    "status": task.get("status"),
                    "priority": task.get("priority"),
                    "estimated_time": task.get("estimated_time"),
                    "scheduled_start_time": task_start_time,
                    "scheduled_end_time": task_end_time,
                    "duration_minutes": duration_minutes,
                    "duration_hours": duration_minutes / 60
                }
                
                # Add task to each hour it spans (only if within view range)
                for hour in range(start_hour_val, min(end_hour_val + 1, 24)):
                    if start_hour <= hour < end_hour and hour in hourly_breakdown:
                        hourly_breakdown[hour]["tasks"].append(task_data)
            except (ValueError, IndexError):
                # Skip tasks with invalid time format
                pass
    
    return list(hourly_breakdown.values())


@router.put("/task/{task_id}/complete")
async def mark_task_complete(task_id: str, user=Depends(get_current_user)):
    """Mark task as completed"""
    task = await reports.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    result = await reports.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {"status": "Done", "updated_at": datetime.utcnow()}}
    )

    if result.modified_count > 0:
        await _log_task_activity(
            task.get("project_id"),
            "task_status_changed",
            f"Task '{task.get('title', task_id)}' marked as Done",
            user,
            {"task_id": task_id, "new_status": "Done"},
        )
    
    return {"id": task_id, "status": "Task marked as completed"}


@router.put("/task/{task_id}/resolve-dependency")
async def resolve_dependency(task_id: str, user=Depends(get_current_user)):
    """Mark dependency as resolved by the tagged user"""
    task = await reports.find_one({"_id": ObjectId(task_id)})
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if user is in the dependencies list
    dependencies = task.get("dependencies", [])
    if user["email"] not in dependencies:
        raise HTTPException(status_code=403, detail="You are not tagged in this task")
    
    # Add user to resolved_dependencies if not already there
    resolved = task.get("resolved_dependencies", [])
    if user["email"] not in resolved:
        result = await reports.update_one(
            {"_id": ObjectId(task_id)},
            {
                "$addToSet": {"resolved_dependencies": user["email"]},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Task not found")

        await _log_task_activity(
            task.get("project_id"),
            "task_dependency_resolved",
            f"Dependency resolved by {user['email']} for task '{task.get('title', task_id)}'",
            user,
            {"task_id": task_id},
        )
    
    return {
        "id": task_id,
        "status": "Dependency resolved",
        "resolved_by": user["email"]
    }


@router.post("/tasks/move-incomplete-to-next-day")
async def move_incomplete_tasks(date: str, user=Depends(get_current_user)):
    """Move all incomplete tasks from a date to the next day as 'Pending' status"""
    from datetime import datetime as dt, timedelta
    
    # Parse the date
    task_date = dt.strptime(date, "%Y-%m-%d")
    next_day = (task_date + timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Find incomplete tasks for the user on the specified date
    incomplete_tasks = await reports.find(
        {
            "type": "TASK",
            "user_id": user["id"],
            "task_date": date,
            "status": {"$in": ["To Do", "In Progress"]}
        }
    ).to_list(None)
    
    moved_count = 0
    
    for task in incomplete_tasks:
        # Update task date to next day and set status to Pending
        result = await reports.update_one(
            {"_id": task["_id"]},
            {
                "$set": {
                    "task_date": next_day,
                    "status": "Pending",
                    "updated_at": datetime.utcnow()
                }
            }
        )
        if result.modified_count > 0:
            moved_count += 1
    
    return {
        "date": date,
        "next_day": next_day,
        "tasks_moved": moved_count,
        "status": "Incomplete tasks moved to next day"
    }

