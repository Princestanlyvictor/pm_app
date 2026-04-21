from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from bson import ObjectId

from app.db import account_requests, users
from app.auth import hash_password
from app.deps import get_current_user
from app.rbac import is_privileged_role

router = APIRouter(prefix="/reports", tags=["requests"])


@router.get("/account-requests")
async def get_account_requests(current_user: dict = Depends(get_current_user)):
    """Get all account creation requests (for project managers)"""
    # Only project managers can view requests
    if not is_privileged_role(current_user.get("role")):
        raise HTTPException(status_code=403, detail="Only project managers can view requests")
    
    try:
        requests = await account_requests.find(
            {"status": "pending"}
        ).to_list(None)
        
        # Convert ObjectId to string for JSON serialization
        for req in requests:
            req["_id"] = str(req["_id"])
        
        return requests
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/account-requests/{request_id}/approve")
async def approve_request(
    request_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Approve an account creation request and create the user"""
    if not is_privileged_role(current_user.get("role")):
        raise HTTPException(status_code=403, detail="Only project managers can approve requests")
    
    try:
        # Find the request
        request_doc = await account_requests.find_one({"_id": ObjectId(request_id)})
        if not request_doc:
            raise HTTPException(status_code=404, detail="Request not found")
        
        if request_doc["status"] != "pending":
            raise HTTPException(status_code=400, detail="Request is not pending")
        
        # Create the user
        user_doc = {
            "email": request_doc["email"],
            "password_hash": request_doc["password_hash"],
            "role": request_doc["role"],
            "created_at": datetime.utcnow(),
            "created_by": current_user.get("_id")
        }
        
        user_result = await users.insert_one(user_doc)
        
        # Update request status
        await account_requests.update_one(
            {"_id": ObjectId(request_id)},
            {
                "$set": {
                    "status": "approved",
                    "approved_at": datetime.utcnow(),
                    "approved_by": current_user.get("email"),
                    "user_id": str(user_result.inserted_id)
                }
            }
        )
        
        return {"message": f"User {request_doc['email']} approved and created"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/account-requests/{request_id}/reject")
async def reject_request(
    request_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Reject an account creation request"""
    if not is_privileged_role(current_user.get("role")):
        raise HTTPException(status_code=403, detail="Only project managers can reject requests")
    
    try:
        # Find the request
        request_doc = await account_requests.find_one({"_id": ObjectId(request_id)})
        if not request_doc:
            raise HTTPException(status_code=404, detail="Request not found")
        
        if request_doc["status"] != "pending":
            raise HTTPException(status_code=400, detail="Request is not pending")
        
        # Update request status
        await account_requests.update_one(
            {"_id": ObjectId(request_id)},
            {
                "$set": {
                    "status": "rejected",
                    "rejected_at": datetime.utcnow(),
                    "rejected_by": current_user.get("email")
                }
            }
        )
        
        return {"message": f"Request from {request_doc['email']} rejected"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
