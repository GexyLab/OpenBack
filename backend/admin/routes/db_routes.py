import logging
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, Literal
from database import db, get_external_db, mongo_json_safe
from auth import require_user, check_app_permission
from activity import log_activity

router = APIRouter(tags=["db-management"])
logger = logging.getLogger(__name__)

SYSTEM_PREFIX = "admin_"
Section = Literal["db", "users"]


class DocPayload(BaseModel):
    data: Dict[str, Any]


async def _get_app_or_404(app_id: str):
    app = await db.admin_apps.find_one({"id": app_id}, {"_id": 0})
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    if not app.get("mongo_url") or not app.get("db_name"):
        raise HTTPException(status_code=400, detail="Database connection not found for this app")
    return app


def _check_collection_for_section(app: dict, section: Section, coll_name: str):
    if coll_name.startswith(SYSTEM_PREFIX):
        raise HTTPException(status_code=403, detail="Collection not allowed")
    if section == "users" and coll_name != app.get("users_collection", "users"):
        raise HTTPException(status_code=403, detail="Collection not allowed for this section")


@router.get("/apps/{app_id}/sections/{section}/collections")
async def list_collections(app_id: str, section: Section, user=Depends(require_user)):
    check_app_permission(user, app_id, section, "view")
    app = await _get_app_or_404(app_id)
    try:
        edb = get_external_db(app["mongo_url"], app["db_name"])
        if section == "users":
            names = [app.get("users_collection", "users")]
        else:
            names = await edb.list_collection_names()
            names = [n for n in names if not n.startswith(SYSTEM_PREFIX)]
        result = []
        for name in names:
            count = await edb[name].count_documents({})
            result.append({"name": name, "count": count})
        return {"collections": result, "connected": True}
    except Exception as e:
        logger.error(f"DB connection failed for app {app_id}: {e}")
        return {"collections": [], "connected": False}


@router.get("/apps/{app_id}/sections/{section}/collections/{coll_name}/documents")
async def list_documents(app_id: str, section: Section, coll_name: str, page: int = 1, limit: int = 25,
                          user=Depends(require_user)):
    check_app_permission(user, app_id, section, "view")
    app = await _get_app_or_404(app_id)
    _check_collection_for_section(app, section, coll_name)
    edb = get_external_db(app["mongo_url"], app["db_name"])
    skip = (page - 1) * limit
    total = await edb[coll_name].count_documents({})
    cursor = edb[coll_name].find({}).skip(skip).limit(limit)
    docs = await cursor.to_list(limit)
    docs = [mongo_json_safe(d) for d in docs]
    return {"documents": docs, "total": total, "page": page, "limit": limit}


@router.post("/apps/{app_id}/sections/{section}/collections/{coll_name}/documents")
async def create_document(app_id: str, section: Section, coll_name: str, payload: DocPayload,
                           user=Depends(require_user)):
    check_app_permission(user, app_id, section, "edit")
    app = await _get_app_or_404(app_id)
    _check_collection_for_section(app, section, coll_name)
    edb = get_external_db(app["mongo_url"], app["db_name"])
    data = dict(payload.data)
    data.pop("_id", None)
    result = await edb[coll_name].insert_one(data)
    doc = await edb[coll_name].find_one({"_id": result.inserted_id})
    doc = mongo_json_safe(doc)
    await log_activity(user, "create_document", f"db:{app_id}:{coll_name}", str(doc.get("_id", "")), details=f"app={app.get('name')}")
    return doc


@router.put("/apps/{app_id}/sections/{section}/collections/{coll_name}/documents/{doc_id}")
async def update_document(app_id: str, section: Section, coll_name: str, doc_id: str, payload: DocPayload,
                           user=Depends(require_user)):
    check_app_permission(user, app_id, section, "edit")
    app = await _get_app_or_404(app_id)
    _check_collection_for_section(app, section, coll_name)
    edb = get_external_db(app["mongo_url"], app["db_name"])
    data = dict(payload.data)
    data.pop("_id", None)
    try:
        oid = ObjectId(doc_id)
    except Exception:
        oid = doc_id
    result = await edb[coll_name].update_one({"_id": oid}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    doc = await edb[coll_name].find_one({"_id": oid})
    await log_activity(user, "update_document", f"db:{app_id}:{coll_name}", doc_id, details=f"app={app.get('name')}")
    return mongo_json_safe(doc)


@router.delete("/apps/{app_id}/sections/{section}/collections/{coll_name}/documents/{doc_id}")
async def delete_document(app_id: str, section: Section, coll_name: str, doc_id: str, user=Depends(require_user)):
    check_app_permission(user, app_id, section, "edit")
    app = await _get_app_or_404(app_id)
    _check_collection_for_section(app, section, coll_name)
    edb = get_external_db(app["mongo_url"], app["db_name"])
    try:
        oid = ObjectId(doc_id)
    except Exception:
        oid = doc_id
    result = await edb[coll_name].delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    await log_activity(user, "delete_document", f"db:{app_id}:{coll_name}", doc_id, details=f"app={app.get('name')}")
    return {"ok": True}
