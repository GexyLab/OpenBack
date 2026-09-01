from fastapi import APIRouter, Depends
from database import db
from auth import require_user, require_super_admin

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("/actions")
async def list_audit_actions(user=Depends(require_user)):
    require_super_admin(user)
    actions = await db.admin_audit_logs.distinct("action")
    return sorted(a for a in actions if a)


@router.get("")
async def list_audit_logs(page: int = 1, limit: int = 50, action: str = None, user_id: str = None,
                           user=Depends(require_user)):
    require_super_admin(user)
    query = {}
    if action:
        query["action"] = action
    if user_id:
        query["actor_user_id"] = user_id
    skip = (page - 1) * limit
    total = await db.admin_audit_logs.count_documents(query)
    logs = await db.admin_audit_logs.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    actor_ids = list({l["actor_user_id"] for l in logs if l.get("actor_user_id")})
    actors = await db.admin_users.find({"user_id": {"$in": actor_ids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(1000)
    name_map = {a["user_id"]: a["name"] for a in actors}
    for l in logs:
        l["actor_name"] = name_map.get(l.get("actor_user_id"), l.get("actor_email") or "—")

    return {"logs": logs, "total": total, "page": page, "limit": limit}
