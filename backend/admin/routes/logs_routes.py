from fastapi import APIRouter, Depends, HTTPException
from database import db
from models import LogCreate, LogEntry
from auth import require_user, check_app_permission

router = APIRouter(tags=["logs"])


@router.get("/apps/{app_id}/logs")
async def list_logs(app_id: str, level: str = None, user=Depends(require_user)):
    check_app_permission(user, app_id, "logs", "view")
    query = {"app_id": app_id}
    if level:
        query["level"] = level
    return await db.admin_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/apps/{app_id}/logs")
async def create_log(app_id: str, payload: LogCreate, user=Depends(require_user)):
    check_app_permission(user, app_id, "logs", "edit")
    entry = LogEntry(app_id=app_id, **payload.model_dump())
    await db.admin_logs.insert_one(entry.model_dump())
    return entry.model_dump()


@router.delete("/apps/{app_id}/logs")
async def clear_logs(app_id: str, user=Depends(require_user)):
    check_app_permission(user, app_id, "logs", "edit")
    await db.admin_logs.delete_many({"app_id": app_id})
    return {"ok": True}
