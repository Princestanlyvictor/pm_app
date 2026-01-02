from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId
from typing import List, Optional

from app.deps import get_current_user
from app.db import reports, users

router = APIRouter(prefix="/reports", tags=["reports"])


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
    task_date: str  # YYYY-MM-DD format
    estimated_time: Optional[int] = None  # in hours
    dependencies: Optional[List[str]] = None  # list of task IDs
    assigned_to: Optional[List[str]] = None  # list of user emails


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
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
    doc = {
        "type": "TASK",
        "project_id": payload.project_id,
        "title": payload.title,
        "description": payload.description,
        "status": payload.status,
        "priority": payload.priority,
        "task_date": payload.task_date,
        "estimated_time": payload.estimated_time,
        "dependencies": payload.dependencies or [],
        "assigned_to": payload.assigned_to or [],
        "user_id": user["id"],
        "user_email": user["email"],
        "created_by": user["email"],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "chat": []
    }
    result = await reports.insert_one(doc)
    return {"id": str(result.inserted_id), "status": "Task submitted"}


@router.put("/task/{task_id}")
async def update_task(task_id: str, payload: TaskUpdateRequest, user=Depends(get_current_user)):
    update_data = {}
    
    if payload.title is not None:
        update_data["title"] = payload.title
    if payload.description is not None:
        update_data["description"] = payload.description
    if payload.status is not None:
        update_data["status"] = payload.status
    if payload.priority is not None:
        update_data["priority"] = payload.priority
    if payload.estimated_time is not None:
        update_data["estimated_time"] = payload.estimated_time
    if payload.dependencies is not None:
        update_data["dependencies"] = payload.dependencies
    if payload.assigned_to is not None:
        update_data["assigned_to"] = payload.assigned_to
    
    update_data["updated_at"] = datetime.utcnow()
    
    result = await reports.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
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
        "task_date": task.get("task_date"),
        "estimated_time": task.get("estimated_time"),
        "dependencies": task.get("dependencies", []),
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
            "estimated_time": task.get("estimated_time"),
            "dependencies": task.get("dependencies", []),
            "assigned_to": task.get("assigned_to", []),
            "created_by": task.get("created_by"),
            "task_date": task.get("task_date"),
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
            "estimated_time": task.get("estimated_time"),
            "dependencies": task.get("dependencies", []),
            "assigned_to": task.get("assigned_to", []),
            "created_by": task.get("created_by"),
            "task_date": task.get("task_date"),
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
        "task_date": task.get("task_date"),
        "estimated_time": task.get("estimated_time"),
        "dependencies": task.get("dependencies", []),
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
            "estimated_time": task.get("estimated_time"),
            "dependencies": task.get("dependencies", []),
            "assigned_to": task.get("assigned_to", []),
            "created_by": task.get("created_by"),
            "task_date": task.get("task_date"),
            "created_at": task.get("created_at")
        })
    
    return grouped_tasks
