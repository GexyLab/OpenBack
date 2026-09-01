import os
from datetime import datetime, timezone
from typing import Annotated, Any, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

_external_clients: dict[str, AsyncIOMotorClient] = {}


def get_external_db(mongo_url: str, db_name: str):
    if mongo_url not in _external_clients:
        _external_clients[mongo_url] = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
    return _external_clients[mongo_url][db_name]


def validate_object_id(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, str):
        return v
    raise ValueError("Invalid ObjectId")


PyObjectId = Annotated[str, BeforeValidator(validate_object_id)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc: dict):
        if doc is None:
            return None
        return cls(**doc)

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True, exclude_none=True)
        if data.get("_id") is None:
            data.pop("_id", None)
        elif isinstance(data.get("_id"), str):
            try:
                data["_id"] = ObjectId(data["_id"])
            except Exception:
                pass
        return data


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def mongo_json_safe(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: mongo_json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [mongo_json_safe(v) for v in value]
    return value
