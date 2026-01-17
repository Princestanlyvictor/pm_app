from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId

from app.db import projects
from app.deps import get_current_user

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str
    description: str = ""


@router.post("")
async def create_project(payload: ProjectCreate, user=Depends(get_current_user)):
    """Create a new project (PM only)"""
    if user.get("role") != "project_manager":
        raise HTTPException(status_code=403, detail="Only project managers can create projects")
    
    # Check if project with same name already exists
    existing = await projects.find_one({"name": payload.name})
    if existing:
        raise HTTPException(status_code=400, detail="Project with this name already exists")
    
    doc = {
        "name": payload.name,
        "description": payload.description,
        "created_by": user.get("email"),
        "created_by_id": user.get("_id"),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await projects.insert_one(doc)
    return {
        "id": str(result.inserted_id),
        "name": payload.name,
        "description": payload.description,
        "message": "Project created successfully"
    }


@router.get("")
async def list_projects(user=Depends(get_current_user)):
    """List all projects"""
    all_projects = await projects.find().sort("name", 1).to_list(None)
    
    return [{
        "id": str(p["_id"]),
        "name": p.get("name"),
        "description": p.get("description"),
        "created_by": p.get("created_by"),
        "created_at": p.get("created_at")
    } for p in all_projects]


@router.get("/{project_id}")
async def get_project(project_id: str, user=Depends(get_current_user)):
    """Get a specific project by ID"""
    project = await projects.find_one({"_id": ObjectId(project_id)})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {
        "id": str(project["_id"]),
        "name": project.get("name"),
        "description": project.get("description"),
        "created_by": project.get("created_by"),
        "created_at": project.get("created_at")
    }


@router.get("/by-name/{project_name}")
async def get_project_by_name(project_name: str, user=Depends(get_current_user)):
    """Get a specific project by name"""
    project = await projects.find_one({"name": project_name})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {
        "id": str(project["_id"]),
        "name": project.get("name"),
        "description": project.get("description"),
        "created_by": project.get("created_by"),
        "created_at": project.get("created_at")
    }
