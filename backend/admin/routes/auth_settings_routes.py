from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
import re
from database import db
from auth import require_user, require_super_admin
from activity import log_activity

router = APIRouter(prefix="/auth-settings", tags=["auth-settings"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

DEFAULTS = {
    "max_login_attempts": 3,
    "lockout_minutes": 15,
    "security_notification_email": "",
    "access_token_minutes": 15,
    "refresh_token_days": 7,
    "two_fa_enabled": True,
}


class AuthSettingsPayload(BaseModel):
    max_login_attempts: int = Field(ge=1)
    lockout_minutes: int = Field(ge=1)
    security_notification_email: str = ""
    access_token_minutes: int = Field(ge=1)
    refresh_token_days: int = Field(ge=1)
    two_fa_enabled: bool = True

    @field_validator("security_notification_email")
    @classmethod
    def validate_email(cls, v):
        if v and not EMAIL_RE.match(v):
            raise ValueError("Email non valida / Invalid email")
        return v


async def get_auth_settings() -> dict:
    doc = await db.admin_auth_settings.find_one({"id": "singleton"}, {"_id": 0})
    if not doc:
        return dict(DEFAULTS)
    return {**DEFAULTS, **doc}


@router.get("")
async def read_settings(user=Depends(require_user)):
    require_super_admin(user)
    return await get_auth_settings()


@router.put("")
async def update_settings(payload: AuthSettingsPayload, user=Depends(require_user)):
    require_super_admin(user)
    data = payload.model_dump()
    await db.admin_auth_settings.update_one({"id": "singleton"}, {"$set": data}, upsert=True)
    await log_activity(user, "update_auth_settings", "auth_settings", details=str(data))
    return await get_auth_settings()
