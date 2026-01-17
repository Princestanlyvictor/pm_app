from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.deps import get_current_user
from app.db import chats, users
from bson import ObjectId

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessageRequest(BaseModel):
    message: str


class DMMessageRequest(BaseModel):
    receiver_id: str
    message: str


@router.get("/messages")
async def get_messages(limit: int = 100, user=Depends(get_current_user)):
    # only global messages
    cursor = chats.find({"type": "global"}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    return [
        {
            "id": str(doc["_id"]),
            "user_email": doc.get("user_email"),
            "user_role": doc.get("user_role"),
            "message": doc.get("message"),
            "created_at": doc.get("created_at"),
        }
        for doc in reversed(items)
    ]


@router.post("/messages")
async def post_message(payload: ChatMessageRequest, user=Depends(get_current_user)):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    doc = {
        "type": "global",
        "user_id": user["id"],
        "user_email": user["email"],
        "user_role": user["role"],
        "message": payload.message.strip(),
        "created_at": datetime.utcnow(),
    }
    result = await chats.insert_one(doc)
    return {"id": str(result.inserted_id)}


@router.get("/users")
async def list_users(user=Depends(get_current_user)):
    cursor = users.find({}, {"email": 1, "role": 1})
    docs = await cursor.to_list(length=None)
    return [
        {
            "id": str(doc["_id"]),
            "email": doc.get("email"),
            "role": doc.get("role", "user"),
        }
        for doc in docs
    ]


def _conversation_key(user_a: str, user_b: str) -> str:
    # stable key so both sides query the same thread
    return "|".join(sorted([user_a, user_b]))


@router.get("/dm/messages")
async def get_dm_messages(participant_id: str = Query(...), user=Depends(get_current_user)):
    key = _conversation_key(user["id"], participant_id)
    cursor = chats.find({"type": "dm", "conversation_key": key}).sort("created_at", -1).limit(200)
    items = await cursor.to_list(length=200)
    return [
        {
            "id": str(doc["_id"]),
            "user_id": doc.get("user_id"),
            "user_email": doc.get("user_email"),
            "user_role": doc.get("user_role"),
            "receiver_id": doc.get("receiver_id"),
            "message": doc.get("message"),
            "created_at": doc.get("created_at"),
        }
        for doc in reversed(items)
    ]


@router.post("/dm/messages")
async def post_dm_message(payload: DMMessageRequest, user=Depends(get_current_user)):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # ensure receiver exists
    receiver = await users.find_one({"_id": ObjectId(payload.receiver_id)})
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    key = _conversation_key(user["id"], payload.receiver_id)
    doc = {
        "type": "dm",
        "conversation_key": key,
        "user_id": user["id"],
        "user_email": user["email"],
        "user_role": user["role"],
        "receiver_id": payload.receiver_id,
        "receiver_email": receiver.get("email"),
        "message": payload.message.strip(),
        "created_at": datetime.utcnow(),
    }
    result = await chats.insert_one(doc)
    return {"id": str(result.inserted_id)}
