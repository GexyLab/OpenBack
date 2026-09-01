import os
import asyncio
import logging
import resend

logger = logging.getLogger(__name__)
resend.api_key = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")


async def send_security_alert(to_email: str, user_email: str, reason: str):
    if not to_email:
        logger.warning("Security notice email not set: skip email send")
        return
    if not os.environ.get("RESEND_API_KEY"):
        logger.warning("RESEND_API_KEY non configurata: email di sicurezza non inviata")
        return
    params = {
        "from": SENDER_EMAIL,
        "to": [to_email],
        "subject": "OpenBack Admin - User disabled for security reasons",
        "html": (
            f"<p>User <strong>{user_email}</strong> is automatically disabled "
            f"from OpenBack admin porta for to many failed logins.</p>"
            f"<p>Info: {reason}</p>"
            f"<p>Only super admin can re-enabled this user by admin portal.</p>"
        ),
    }
    try:
        await asyncio.to_thread(resend.Emails.send, params)
    except Exception as e:
        logger.error(f"Security email send failed: {e}")
