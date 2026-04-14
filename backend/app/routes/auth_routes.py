from fastapi import APIRouter, HTTPException, Depends
from app.auth import hash_password, verify_password, create_access_token
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId

from app.db import users, account_requests
from app.auth import hash_password, verify_password, create_access_token
from app.deps import get_current_user
from app.rbac import is_privileged_role

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: Optional[str] = None
    email: str
    password: str
    role: str = "team_member"


def _normalize_role(role: str) -> str:
    value = str(role or "team_member").strip().lower()
    if value in ["admin", "project_manager"]:
        return "admin"
    if value in ["team_member", "member", "user"]:
        return "team_member"
    return "team_member"


@router.post("/register")
async def register(payload: RegisterRequest):
    normalized_role = _normalize_role(payload.role)

    # Check if email already exists (either in users or requests)
    existing_user = await users.find_one({"email": payload.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    existing_request = await account_requests.find_one({"email": payload.email, "status": "pending"})
    if existing_request:
        raise HTTPException(status_code=400, detail="Request already submitted, waiting for approval")

    # Project managers and admins are created directly without approval
    if normalized_role == "admin":
        user_doc = {
            "name": payload.name,
            "email": payload.email,
            "password_hash": hash_password(payload.password),
            "role": normalized_role,
            "created_at": datetime.utcnow()
        }
        result = await users.insert_one(user_doc)
        return {"message": "Admin account created successfully", "id": str(result.inserted_id)}
    
    # Other roles need approval
    request_doc = {
        "name": payload.name,
        "email": payload.email,
        "password_hash": hash_password(payload.password),
        "role": normalized_role,
        "status": "pending",
        "requested_at": datetime.utcnow(),
        "requested_by": payload.email
    }

    result = await account_requests.insert_one(request_doc)
    return {"message": "Registration request submitted. Waiting for admin approval.", "id": str(result.inserted_id)}


@router.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await users.find_one({"email": form_data.username})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid credentials")

    if not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    token = create_access_token(
        sub=str(user["_id"]),
        role=user["role"]
    )

    return {
        "access_token": token,
        "token_type": "bearer"
    }


@router.get("/users")
async def get_all_users(user=Depends(get_current_user)):
    """Get all users (team members) for tagging/dependencies"""
    if is_privileged_role(user.get("role")):
        all_users = await users.find().to_list(None)
    else:
        # Non-admin users should only see themselves to avoid exposing unrelated account data.
        all_users = await users.find({"email": user.get("email")}).to_list(None)

    return [{
        "id": str(u["_id"]),
        "email": u["email"],
        "role": u["role"]
    } for u in all_users]
