from fastapi import APIRouter, HTTPException, Depends
from app.auth import hash_password, verify_password, create_access_token
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime
from pydantic import BaseModel
from bson import ObjectId

from app.db import users
from app.auth import hash_password, verify_password, create_access_token
from app.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    role: str = "user"


@router.post("/register")
async def register(payload: RegisterRequest):
    existing = await users.find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    doc = {
        "email": payload.email,
        "password_hash": hash_password(payload.password),
        "role": payload.role,
        "created_at": datetime.utcnow()
    }

    result = await users.insert_one(doc)
    return {"id": str(result.inserted_id)}


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
    all_users = await users.find().to_list(None)
    return [{
        "id": str(u["_id"]),
        "email": u["email"],
        "role": u["role"]
    } for u in all_users]
