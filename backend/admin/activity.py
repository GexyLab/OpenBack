from database import db
from models import AuditLog, Notification


async def log_activity(user, action: str, target_type: str, target_id: str = None, details: str = ""):
    entry = AuditLog(
        actor_user_id=getattr(user, "user_id", None),
        actor_email=getattr(user, "email", None),
        action=action, target_type=target_type, target_id=target_id, details=details,
    )
    await db.admin_audit_logs.insert_one(entry.model_dump())


async def notify_user(user_id: str, title: str, message: str, task_id: str = None):
    if not user_id:
        return
    notif = Notification(user_id=user_id, title=title, message=message, task_id=task_id)
    await db.admin_notifications.insert_one(notif.model_dump())
