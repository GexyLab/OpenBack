import base64
import io
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
import pyotp
import qrcode
from fastapi import Cookie, Header, HTTPException

from database import db
from models import User

JWT_ALGORITHM = "HS256"
ISSUER_NAME = "GexyLab Admin"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_token(user_id: str, token_type: str, minutes: int) -> str:
    payload = {
        "sub": user_id,
        "type": token_type,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str, expected_type: str) -> str:
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != expected_type:
        raise HTTPException(status_code=401, detail="Invalid token type")
    return payload["sub"]


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def totp_provisioning_qr_base64(email: str, secret: str) -> str:
    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=ISSUER_NAME)
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def verify_totp_code(secret: str, code: str) -> bool:
    return pyotp.TOTP(secret).verify(code, valid_window=1)


async def get_effective_app_permissions(user_doc: dict) -> list:
    order = {"none": 0, "view": 1, "edit": 2}
    merged = {}
    group_ids = user_doc.get("group_ids") or []
    if group_ids:
        groups = await db.admin_groups.find({"id": {"$in": group_ids}}, {"_id": 0}).to_list(100)
        for group in groups:
            for perm in group.get("app_permissions", []):
                app_id = perm["app_id"]
                cur = merged.setdefault(app_id, {"logs": "none", "settings": "none", "users": "none", "db": "none"})
                for s in ("logs", "settings", "users", "db"):
                    if order.get(perm.get(s, "none"), 0) > order.get(cur[s], 0):
                        cur[s] = perm.get(s, "none")
    for perm in user_doc.get("app_permissions") or []:
        merged[perm["app_id"]] = {s: perm.get(s, "none") for s in ("logs", "settings", "users", "db")}
    return [{"app_id": app_id, **vals} for app_id, vals in merged.items()]


async def get_session_user(
    access_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
) -> Optional[User]:
    token = access_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    if not token:
        return None
    try:
        user_id = decode_token(token, "access")
    except HTTPException:
        return None
    user_doc = await db.admin_users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc or not user_doc.get("is_active", True):
        return None
    user_doc["app_permissions"] = await get_effective_app_permissions(user_doc)
    return User(**user_doc)


async def require_user(
    access_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
) -> User:
    user = await get_session_user(access_token, authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def get_app_permission(user: User, app_id: str, section: str) -> str:
    if user.portal_role == "super_admin":
        return "edit"
    for perm in user.app_permissions:
        if perm.app_id == app_id:
            return getattr(perm, section, "none")
    return "none"


def check_app_permission(user: User, app_id: str, section: str, min_level: str = "view"):
    level = get_app_permission(user, app_id, section)
    order = {"none": 0, "view": 1, "edit": 2}
    if order.get(level, 0) < order.get(min_level, 1):
        raise HTTPException(status_code=403, detail=" Insufficient permissions")


def require_super_admin(user: User):
    if user.portal_role != "super_admin":
        raise HTTPException(status_code=403, detail=" Super admin only")


def public_user(user) -> dict:
    d = user.model_dump() if hasattr(user, "model_dump") else dict(user)
    d.pop("password_hash", None)
    d.pop("totp_secret", None)
    return d


async def count_super_admins(exclude_user_id: Optional[str] = None) -> int:
    query = {"portal_role": "super_admin"}
    if exclude_user_id:
        query["user_id"] = {"$ne": exclude_user_id}
    return await db.admin_users.count_documents(query)


def has_any_app_access(user: User, app_id: str) -> bool:
    if user.portal_role == "super_admin":
        return True
    for perm in user.app_permissions:
        if perm.app_id == app_id and any(
            getattr(perm, s) != "none" for s in ("logs", "settings", "users", "db")
        ):
            return True
    return False


def get_accessible_app_ids(user: User) -> set:
    return {
        p.app_id for p in user.app_permissions
        if any(getattr(p, s) != "none" for s in ("logs", "settings", "users", "db"))
    }

'''
async def get_accessible_project_ids(user: User) -> Optional[set]:
    if user.portal_role == "super_admin":
        return None
    app_ids = get_accessible_app_ids(user)
    if not app_ids:
        return set()
    docs = await db.admin_apps.find({"id": {"$in": list(app_ids)}}, {"_id": 0, "project_id": 1}).to_list(1000)
    return {d["project_id"] for d in docs}


async def check_project_access(user: User, project_id: str):
    if user.portal_role == "super_admin":
        return
    accessible = await get_accessible_project_ids(user)
    if accessible is not None and project_id not in accessible:
        raise HTTPException(status_code=403, detail="Permessi insufficienti / Insufficient permissions")
'''