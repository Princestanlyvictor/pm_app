from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from app.auth import SECRET_KEY, ALGORITHM
from app.db import users
from bson import ObjectId

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        role: str = payload.get("role")
        
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise credentials_exception
    
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "role": user["role"]
    }
