from datetime import datetime, timezone
from typing import List, Literal, Optional
from pydantic import BaseModel, Field
import uuid

PermLevel = Literal["none", "view", "edit"]
PortalRole = Literal["super_admin", "member"]
TaskStatus = Literal["todo", "in_progress", "done"]
TaskPriority = Literal["low", "medium", "high"]
LogLevel = Literal["info", "warning", "error"]


def gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class AppSectionPermissions(BaseModel):
    app_id: str
    logs: PermLevel = "none"
    settings: PermLevel = "none"
    users: PermLevel = "none"
    db: PermLevel = "none"


class User(BaseModel):
    user_id: str = Field(default_factory=lambda: gen_id("user"))
    email: str
    name: str
    password_hash: str
    totp_secret: Optional[str] = None
    totp_enabled: bool = False
    portal_role: PortalRole = "member"
    app_permissions: List[AppSectionPermissions] = Field(default_factory=list)
    group_ids: List[str] = Field(default_factory=list)
    is_active: bool = True
    failed_login_attempts: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_login: Optional[str] = None


class UserSession(BaseModel):
    session_token: str
    user_id: str
    expires_at: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

'''
class Project(BaseModel):
    id: str = Field(default_factory=lambda: gen_id("proj"))
    name: str
    description: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: Optional[str] = None


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
'''

class App(BaseModel):
    id: str = Field(default_factory=lambda: gen_id("app"))
    project_id: str
    name: str
    description: str = ""
    frontend_url: str = ""
    backend_url: str = ""
    mongo_url: str = ""
    db_name: str = ""
    users_collection: str = "users"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AppCreate(BaseModel):
    name: str
    description: str = ""
    frontend_url: str = ""
    backend_url: str = ""
    mongo_url: str = ""
    db_name: str = ""
    users_collection: str = "users"

'''
class Task(BaseModel):
    id: str = Field(default_factory=lambda: gen_id("task"))
    project_id: str
    title: str
    description: str = ""
    status: TaskStatus = "todo"
    priority: TaskPriority = "medium"
    assignee_user_id: Optional[str] = None
    due_date: Optional[str] = None
    due_notified: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TaskCreate(BaseModel):
    title: str
    description: str = ""
    status: TaskStatus = "todo"
    priority: TaskPriority = "medium"
    assignee_user_id: Optional[str] = None
    due_date: Optional[str] = None


class Attachment(BaseModel):
    id: str = Field(default_factory=lambda: gen_id("att"))
    project_id: str
    filename: str
    storage_path: str
    content_type: str
    size: int
    uploaded_by: str
    is_deleted: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
'''

class LogEntry(BaseModel):
    id: str = Field(default_factory=lambda: gen_id("log"))
    app_id: str
    level: LogLevel = "info"
    message: str
    source: str = "system"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class LogCreate(BaseModel):
    level: LogLevel = "info"
    message: str
    source: str = "system"


class Group(BaseModel):
    id: str = Field(default_factory=lambda: gen_id("group"))
    name: str
    description: str = ""
    app_permissions: List[AppSectionPermissions] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class GroupCreate(BaseModel):
    name: str
    description: str = ""
    app_permissions: List[AppSectionPermissions] = Field(default_factory=list)


class Notification(BaseModel):
    id: str = Field(default_factory=lambda: gen_id("notif"))
    user_id: str
    title: str
    message: str
    task_id: Optional[str] = None
    read: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AuditLog(BaseModel):
    id: str = Field(default_factory=lambda: gen_id("audit"))
    actor_user_id: Optional[str] = None
    actor_email: Optional[str] = None
    action: str
    target_type: str
    target_id: Optional[str] = None
    details: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
