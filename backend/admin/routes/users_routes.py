import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from database import db
from models import User, AppSectionPermissions
from auth import require_user, require_super_admin, public_user, hash_password, count_super_admins
from activity import log_activity

router = APIRouter(prefix="/users", tags=["users"])


class CreateUserPayload(BaseModel):
    name: str
    email: EmailStr
    password: str
    portal_role: str = "member"
    group_ids: List[str] = []


class UpdateUserPayload(BaseModel):
    portal_role: Optional[str] = None
    app_permissions: Optional[List[AppSectionPermissions]] = None
    group_ids: Optional[List[str]] = None


@router.get("")
async def list_users(user=Depends(require_user)):
    require_super_admin(user)
    docs = await db.admin_users.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [public_user(d) for d in docs]


@router.post("")
async def create_user(payload: CreateUserPayload, user=Depends(require_user)):
    require_super_admin(user)
    email = payload.email.lower()
    existing = await db.admin_users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail=" Email already registered")
    new_user = User(
        user_id=f"user_{uuid.uuid4().hex[:12]}", email=email, name=payload.name,
        password_hash=hash_password(payload.password), portal_role=payload.portal_role,
        group_ids=payload.group_ids,
    )
    await db.admin_users.insert_one(new_user.model_dump())
    await log_activity(user, "create_user", "user", new_user.user_id, details=email)
    return public_user(new_user.model_dump())


@router.get("/{user_id}")
async def get_user(user_id: str, user=Depends(require_user)):
    require_super_admin(user)
    doc = await db.admin_users.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return public_user(doc)


@router.put("/{user_id}")
async def update_user(user_id: str, payload: UpdateUserPayload, user=Depends(require_user)):
    require_super_admin(user)
    target = await db.admin_users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    data = {}
    if payload.portal_role is not None:
        if target["portal_role"] == "super_admin" and payload.portal_role != "super_admin":
            if await count_super_admins(exclude_user_id=user_id) < 1:
                raise HTTPException(status_code=400, detail=" At least one admin must remain")
        data["portal_role"] = payload.portal_role
    if payload.app_permissions is not None:
        data["app_permissions"] = [p.model_dump() for p in payload.app_permissions]
    if payload.group_ids is not None:
        data["group_ids"] = payload.group_ids
    if not data:
        raise HTTPException(status_code=400, detail="No data to update")
    await db.admin_users.update_one({"user_id": user_id}, {"$set": data})
    await log_activity(user, "update_user", "user", user_id, details=target.get("email"))
    doc = await db.admin_users.find_one({"user_id": user_id}, {"_id": 0})
    return public_user(doc)


@router.post("/{user_id}/deactivate")
async def deactivate_user(user_id: str, user=Depends(require_user)):
    require_super_admin(user)
    if user_id == user.user_id:
        raise HTTPException(status_code=400, detail="You cannot deactivate yourself")
    target = await db.admin_users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if target["portal_role"] == "super_admin" and await count_super_admins(exclude_user_id=user_id) < 1:
        raise HTTPException(status_code=400, detail=" At least one admin must remain")
    await db.admin_users.update_one({"user_id": user_id}, {"$set": {"is_active": False}})
    await log_activity(user, "deactivate_user", "user", user_id, details=target.get("email"))
    doc = await db.admin_users.find_one({"user_id": user_id}, {"_id": 0})
    return public_user(doc)


@router.post("/{user_id}/reactivate")
async def reactivate_user(user_id: str, user=Depends(require_user)):
    require_super_admin(user)
    target = await db.admin_users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.admin_users.update_one(
        {"user_id": user_id}, {"$set": {"is_active": True, "failed_login_attempts": 0}}
    )
    await log_activity(user, "reactivate_user", "user", user_id, details=target.get("email"))
    doc = await db.admin_users.find_one({"user_id": user_id}, {"_id": 0})
    return public_user(doc)


@router.post("/{user_id}/reset-2fa")
async def reset_2fa(user_id: str, user=Depends(require_user)):
    require_super_admin(user)
    target = await db.admin_users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.admin_users.update_one(
        {"user_id": user_id}, {"$set": {"totp_enabled": False, "totp_secret": None}}
    )
    await log_activity(user, "reset_2fa", "user", user_id, details=target.get("email"))
    doc = await db.admin_users.find_one({"user_id": user_id}, {"_id": 0})
    return public_user(doc)


@router.delete("/{user_id}")
async def delete_user(user_id: str, user=Depends(require_user)):
    require_super_admin(user)
    if user_id == user.user_id:
        raise HTTPException(status_code=400, detail="You can't delete yourself")
    target = await db.admin_users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.admin_users.delete_one({"user_id": user_id})
    await log_activity(user, "delete_user", "user", user_id, details=target.get("email"))
    return {"ok": True}
