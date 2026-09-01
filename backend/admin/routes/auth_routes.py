from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from database import db
from models import User
from auth import (
    hash_password, verify_password, create_token, decode_token,
    generate_totp_secret, totp_provisioning_qr_base64, verify_totp_code,
    require_user, get_session_user, public_user, get_effective_app_permissions,
)
from activity import log_activity
#from routes.cron_routes import _run_due_task_check
from routes.auth_settings_routes import get_auth_settings
from email_service import send_security_alert

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class TwoFAVerifyPayload(BaseModel):
    setup_token: str = None
    login_token: str = None
    code: str


def _set_session_cookies(response: Response, user_id: str, access_minutes: int, refresh_days: int):
    access_token = create_token(user_id, "access", access_minutes)
    refresh_token = create_token(user_id, "refresh", refresh_days * 24 * 60)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True,
                         samesite="none", max_age=access_minutes * 60, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True,
                         samesite="none", max_age=refresh_days * 24 * 60 * 60, path="/")


async def _totp_setup_response(user_doc: dict):
    secret = user_doc.get("totp_secret")
    if not secret:
        secret = generate_totp_secret()
        await db.admin_users.update_one({"user_id": user_doc["user_id"]}, {"$set": {"totp_secret": secret}})
    qr_code = totp_provisioning_qr_base64(user_doc["email"], secret)
    setup_token = create_token(user_doc["user_id"], "2fa_setup", 10)
    return {"requires_2fa_setup": True, "setup_token": setup_token, "qr_code_base64": qr_code,
            "secret": secret, "email": user_doc["email"]}


async def _complete_login(response: Response, background_tasks: BackgroundTasks, user_id: str, settings: dict):
    now = datetime.now(timezone.utc).isoformat()
    await db.admin_users.update_one({"user_id": user_id}, {"$set": {"last_login": now}})
    _set_session_cookies(response, user_id, settings["access_token_minutes"], settings["refresh_token_days"])
    user_doc = await db.admin_users.find_one({"user_id": user_id}, {"_id": 0})
    user_doc["app_permissions"] = await get_effective_app_permissions(user_doc)
    await log_activity(SimpleNamespace(user_id=user_id, email=user_doc["email"]), "login", "auth", details=user_doc["email"])
    #background_tasks.add_task(_run_due_task_check)
    return public_user(user_doc)


@router.post("/login")
async def login(payload: LoginPayload, request: Request, response: Response, background_tasks: BackgroundTasks):
    email = payload.email.lower()
    settings = await get_auth_settings()

    user_doc = await db.admin_users.find_one({"email": email}, {"_id": 0})
    if not user_doc or not user_doc.get("password_hash"):
        await log_activity(SimpleNamespace(user_id=None, email=email), "login_failed", "user", details=email)
        raise HTTPException(status_code=401, detail=" Invalid credentials")

    if not user_doc.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account disabled. Contact an administrator.")

    locked_until = user_doc.get("locked_until")
    if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
        raise HTTPException(status_code=403, detail="Too many failed attempts. Try again later.")

    if not verify_password(payload.password, user_doc["password_hash"]):
        new_count = user_doc.get("failed_login_attempts", 0) + 1
        update = {"failed_login_attempts": new_count}
        will_lock = new_count >= settings["max_login_attempts"]
        lockout_minutes = settings.get("lockout_minutes", 15)
        if will_lock:
            update["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=lockout_minutes)).isoformat()
        await db.admin_users.update_one({"user_id": user_doc["user_id"]}, {"$set": update})
        await log_activity(SimpleNamespace(user_id=user_doc["user_id"], email=email), "login_failed", "user",
                            user_doc["user_id"], details=f"tentativo {new_count}/{settings['max_login_attempts']}")
        if will_lock:
            await log_activity(SimpleNamespace(user_id=user_doc["user_id"], email=email), "account_locked", "user",
                                user_doc["user_id"], details=f"locked for {lockout_minutes} minutes after too many login attempts")
            background_tasks.add_task(
                send_security_alert, settings.get("security_notification_email", ""), email,
                f"{new_count} attempts to login failed consecutivly"
            )
            raise HTTPException(
                status_code=403,
                detail=f"Too many failed attempts. Account locked for {lockout_minutes} minutes.",
            )
        raise HTTPException(status_code=401, detail=" Invalid credentials")

    if user_doc.get("failed_login_attempts", 0) > 0 or user_doc.get("locked_until"):
        await db.admin_users.update_one(
            {"user_id": user_doc["user_id"]},
            {"$set": {"failed_login_attempts": 0}, "$unset": {"locked_until": ""}},
        )

    if not settings.get("two_fa_enabled", True):
        return await _complete_login(response, background_tasks, user_doc["user_id"], settings)

    if not user_doc.get("totp_enabled"):
        return await _totp_setup_response(user_doc)

    login_token = create_token(user_doc["user_id"], "2fa_login", 5)
    return {"requires_2fa": True, "login_token": login_token}


@router.post("/2fa/setup/verify")
async def verify_2fa_setup(payload: TwoFAVerifyPayload, response: Response, background_tasks: BackgroundTasks):
    if not payload.setup_token:
        raise HTTPException(status_code=400, detail="setup_token required")
    user_id = decode_token(payload.setup_token, "2fa_setup")
    user_doc = await db.admin_users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc or not user_doc.get("totp_secret"):
        raise HTTPException(status_code=400, detail="2FA setup not found")
    if not verify_totp_code(user_doc["totp_secret"], payload.code):
        raise HTTPException(status_code=401, detail="Invalid code")

    settings = await get_auth_settings()
    await db.admin_users.update_one({"user_id": user_id}, {"$set": {"totp_enabled": True}})
    return await _complete_login(response, background_tasks, user_id, settings)


@router.post("/2fa/verify")
async def verify_2fa_login(payload: TwoFAVerifyPayload, response: Response, background_tasks: BackgroundTasks):
    if not payload.login_token:
        raise HTTPException(status_code=400, detail="login_token required")
    user_id = decode_token(payload.login_token, "2fa_login")
    user_doc = await db.admin_users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc or not user_doc.get("totp_secret"):
        raise HTTPException(status_code=400, detail="2FA not configured")
    if not verify_totp_code(user_doc["totp_secret"], payload.code):
        raise HTTPException(status_code=401, detail="Invalid code")

    settings = await get_auth_settings()
    return await _complete_login(response, background_tasks, user_id, settings)


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    user_id = decode_token(refresh_token, "refresh")
    user_doc = await db.admin_users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc or not user_doc.get("is_active", True):
        invalid_resp = JSONResponse(status_code=401, content={"detail": "Invalid account"})
        invalid_resp.delete_cookie("access_token", path="/")
        invalid_resp.delete_cookie("refresh_token", path="/")
        return invalid_resp
    settings = await get_auth_settings()
    access_minutes = settings["access_token_minutes"]
    access_token = create_token(user_id, "access", access_minutes)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True,
                         samesite="none", max_age=access_minutes * 60, path="/")
    return {"ok": True}


@router.get("/me")
async def get_me(user: User = Depends(require_user)):
    return public_user(user)


@router.post("/logout")
async def logout(response: Response, user=Depends(get_session_user)):
    if user:
        await log_activity(user, "logout", "auth", details=user.email)
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}
