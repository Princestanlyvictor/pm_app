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

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: Optional[str] = None
    email: str
    password: str
    role: str = "user"


class ApprovalRequest(BaseModel):
    request_id: str
    action: str  # "approve" or "reject"
    reason: Optional[str] = None  # Reason for rejection


@router.post("/register")
async def register(payload: RegisterRequest):
    try:
        # Check if email already exists (either in users or requests)
        existing_user = await users.find_one({"email": payload.email})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        existing_request = await account_requests.find_one({"email": payload.email, "status": "pending"})
        if existing_request:
            raise HTTPException(status_code=400, detail="Request already submitted, waiting for approval")

        # Project managers and admins are created directly without approval
        if payload.role in ["admin", "project_manager"]:
            user_doc = {
                "name": payload.name,
                "email": payload.email,
                "password_hash": hash_password(payload.password),
                "role": payload.role,
                "created_at": datetime.utcnow()
            }
            result = await users.insert_one(user_doc)
            return {"message": f"{payload.role.capitalize()} account created successfully", "id": str(result.inserted_id)}
        
        # Other roles need approval
        request_doc = {
            "name": payload.name,
            "email": payload.email,
            "password_hash": hash_password(payload.password),
            "role": payload.role,
            "status": "pending",
            "requested_at": datetime.utcnow(),
            "requested_by": payload.email
        }

        result = await account_requests.insert_one(request_doc)
        return {"message": "Registration request submitted. Waiting for admin approval.", "id": str(result.inserted_id)}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Registration error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@router.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # Check if user exists in the users collection (approved users)
    user = await users.find_one({"email": form_data.username})
    
    if not user:
        # Check if there's a pending account request
        pending_request = await account_requests.find_one({
            "email": form_data.username,
            "status": "pending"
        })
        
        if pending_request:
            # User registered but not yet approved by admin
            raise HTTPException(
                status_code=403,
                detail="Account pending admin approval. Please wait for approval."
            )
        
        # Check if account was rejected
        rejected_request = await account_requests.find_one({
            "email": form_data.username,
            "status": "rejected"
        })
        
        if rejected_request:
            # Account was rejected by admin
            reason = rejected_request.get("rejection_reason", "No reason provided")
            raise HTTPException(
                status_code=403,
                detail=f"Account request was rejected. Reason: {reason}"
            )
        
        # User doesn't exist anywhere - invalid credentials
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

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


@router.get("/pending-requests")
async def get_pending_requests(user=Depends(get_current_user)):
    """Get all pending account requests (admin only)"""
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view pending requests")
    
    pending = await account_requests.find({"status": "pending"}).to_list(None)
    return [{
        "id": str(req["_id"]),
        "name": req.get("name", ""),
        "email": req["email"],
        "role": req["role"],
        "requested_at": req["requested_at"],
        "status": req["status"]
    } for req in pending]


@router.post("/approve-request")
async def approve_request(payload: ApprovalRequest, user=Depends(get_current_user)):
    """Approve a pending account request (admin only)"""
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can approve requests")
    
    try:
        request_id = ObjectId(payload.request_id)
        request_doc = await account_requests.find_one({"_id": request_id})
        
        if not request_doc:
            raise HTTPException(status_code=404, detail="Request not found")
        
        if request_doc["status"] != "pending":
            raise HTTPException(status_code=400, detail=f"Request is already {request_doc['status']}")
        
        # Move user from account_requests to users collection
        user_doc = {
            "name": request_doc.get("name", ""),
            "email": request_doc["email"],
            "password_hash": request_doc["password_hash"],
            "role": request_doc["role"],
            "created_at": datetime.utcnow(),
            "approved_at": datetime.utcnow(),
            "approved_by": user["email"]
        }
        
        # Insert into users collection
        await users.insert_one(user_doc)
        
        # Update request status to approved
        await account_requests.update_one(
            {"_id": request_id},
            {"$set": {"status": "approved", "approved_at": datetime.utcnow()}}
        )
        
        return {"message": f"Account request for {request_doc['email']} approved successfully"}
    
    except Exception as e:
        print(f"Approval error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to approve request: {str(e)}")


@router.post("/reject-request")
async def reject_request(payload: ApprovalRequest, user=Depends(get_current_user)):
    """Reject a pending account request (admin only)"""
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can reject requests")
    
    try:
        request_id = ObjectId(payload.request_id)
        request_doc = await account_requests.find_one({"_id": request_id})
        
        if not request_doc:
            raise HTTPException(status_code=404, detail="Request not found")
        
        if request_doc["status"] != "pending":
            raise HTTPException(status_code=400, detail=f"Request is already {request_doc['status']}")
        
        # Update request status to rejected
        await account_requests.update_one(
            {"_id": request_id},
            {
                "$set": {
                    "status": "rejected",
                    "rejected_at": datetime.utcnow(),
                    "rejected_by": user["email"],
                    "rejection_reason": payload.reason or "No reason provided"
                }
            }
        )
        
        return {"message": f"Account request for {request_doc['email']} rejected successfully"}
    
    except Exception as e:
        print(f"Rejection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reject request: {str(e)}")
