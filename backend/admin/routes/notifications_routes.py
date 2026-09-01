from fastapi import APIRouter, Depends, HTTPException
from database import db
from auth import require_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(user=Depends(require_user)):
    notifs = await db.admin_notifications.find({"user_id": user.user_id}, {"_id": 0}) \
        .sort("created_at", -1).limit(50).to_list(50)
    unread_count = await db.admin_notifications.count_documents({"user_id": user.user_id, "read": False})
    return {"notifications": notifs, "unread_count": unread_count}


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str, user=Depends(require_user)):
    result = await db.admin_notifications.update_one(
        {"id": notification_id, "user_id": user.user_id}, {"$set": {"read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notifica non trovata")
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(user=Depends(require_user)):
    await db.admin_notifications.update_many({"user_id": user.user_id, "read": False}, {"$set": {"read": True}})
    return {"ok": True}
