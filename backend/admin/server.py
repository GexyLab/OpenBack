import logging
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from database import client, db
#from seed import seed_carpack, seed_admin, seed_extra_admin
#from routes import (
#    auth_routes, projects_routes, apps_routes, tasks_routes, attachments_routes, users_routes,
#    logs_routes, db_routes, groups_routes, audit_routes, notifications_routes, cron_routes,
#    auth_settings_routes,
#)

from routes import ( auth_routes, users_routes, db_routes )

#from apiserv import admin_routes as apiserv_admin_routes, proxy_routes as apiserv_proxy_routes
#from apiserv.admin_routes import get_apiserv_settings, seed_apiserv_groups, migrate_route_pipeline_ids
#from apiserv.models import retention_to_seconds

app = FastAPI(title="GexyLab Admin API")

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_routes.router)
#api_router.include_router(projects_routes.router)
#api_router.include_router(apps_routes.router)
#api_router.include_router(tasks_routes.router)
#api_router.include_router(attachments_routes.router)
api_router.include_router(users_routes.router)
#api_router.include_router(groups_routes.router)
#api_router.include_router(logs_routes.router)
api_router.include_router(db_routes.router)
#api_router.include_router(audit_routes.router)
#api_router.include_router(notifications_routes.router)
#api_router.include_router(cron_routes.router)
#api_router.include_router(auth_settings_routes.router)
#api_router.include_router(apiserv_admin_routes.router)
#api_router.include_router(apiserv_proxy_routes.router)


@api_router.get("/")
async def root():
    return {"message": "GexyLab Admin API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_event():
    #try:
    #    from storage import init_storage
    #    init_storage()
    #    logger.info("Storage initialized")
    #except Exception as e:
    #    logger.error(f"Storage init failed: {e}")
    await db.admin_users.create_index("email", unique=True)
    #await db.apiserv_rate_counters.create_index("created_at", expireAfterSeconds=3600)
    #apiserv_settings = await get_apiserv_settings()
    #retention_seconds = retention_to_seconds(apiserv_settings["log_retention_days"])
    
    #try:
    #    await db.apiserv_logs.create_index("created_at", expireAfterSeconds=retention_seconds)
    #except Exception:
    #    await db.command({
    #        "collMod": "apiserv_logs",
    #        "index": {"keyPattern": {"created_at": 1}, "expireAfterSeconds": retention_seconds},
    #    })
    
    #await seed_admin()
    #await seed_extra_admin()
    #await seed_carpack()
    #await seed_apiserv_groups()
    #await migrate_route_pipeline_ids()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
