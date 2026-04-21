from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import certifi
from datetime import datetime
from pymongo import ASCENDING, DESCENDING

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

client = AsyncIOMotorClient(
    MONGO_URI,
    tlsCAFile=certifi.where()
)

db = client.pm_app

users = db.users
projects = db.projects
tasks = db.tasks
reports = db.reports
chats = db.chats
account_requests = db.account_requests
project_docs = db.project_docs
project_activities = db.project_activities
daily_plans = db.daily_plans
work_blocks = db.work_blocks
audit_logs = db.audit_logs


async def ensure_indexes():
    await users.create_index([("email", ASCENDING)], unique=True)
    await projects.create_index([("name", ASCENDING)])
    await projects.create_index([("status", ASCENDING)])
    await projects.create_index([("members.email", ASCENDING)])

    await reports.create_index([("type", ASCENDING), ("project_id", ASCENDING)])
    await reports.create_index([("project_id", ASCENDING), ("status", ASCENDING)])
    await reports.create_index([("project_id", ASCENDING), ("priority", ASCENDING)])
    await reports.create_index([("project_id", ASCENDING), ("stage", ASCENDING)])
    await reports.create_index([("project_id", ASCENDING), ("task_date", DESCENDING)])
    await reports.create_index([("user_email", ASCENDING), ("project_id", ASCENDING)])

    await project_docs.create_index([("project_id", ASCENDING), ("updated_at", DESCENDING)])
    await project_activities.create_index([("project_id", ASCENDING), ("created_at", DESCENDING)])
    await audit_logs.create_index([("entity_type", ASCENDING), ("entity_id", ASCENDING), ("created_at", DESCENDING)])
    await audit_logs.create_index([("actor_email", ASCENDING), ("created_at", DESCENDING)])

    await daily_plans.create_index([("user_email", ASCENDING), ("date", ASCENDING)], unique=True)
    await daily_plans.create_index([("date", ASCENDING)])
    await work_blocks.create_index([("daily_plan_id", ASCENDING), ("start_minutes", ASCENDING)])
    await work_blocks.create_index([("task_id", ASCENDING), ("date", ASCENDING)])
    await work_blocks.create_index([("user_email", ASCENDING), ("date", ASCENDING), ("status", ASCENDING)])


async def ensure_rbac_backfill():
    # Legacy projects without assignments become admin-only by default.
    legacy_projects_query = {
        "$and": [
            {"$or": [{"members": {"$exists": False}}, {"members": []}]},
            {"$or": [{"team_members": {"$exists": False}}, {"team_members": []}]},
        ]
    }
    await projects.update_many(
        legacy_projects_query,
        {
            "$set": {
                "members": [],
                "team_members": [],
                "legacy_visibility": "admin_only",
                "updated_at": datetime.utcnow(),
                "updated_by": "system_migration",
            }
        },
    )

    # Ensure project documents always include assignment arrays.
    await projects.update_many(
        {"members": {"$exists": False}},
        {"$set": {"members": [], "updated_at": datetime.utcnow()}},
    )
    await projects.update_many(
        {"team_members": {"$exists": False}},
        {"$set": {"team_members": [], "updated_at": datetime.utcnow()}},
    )

    # Legacy tasks without explicit assignees are assigned to their creator/owner for compatibility.
    task_rows = await reports.find(
        {
            "type": "TASK",
            "$or": [
                {"assigned_to": {"$exists": False}},
                {"assigned_to": []},
                {"assigned_to": None},
            ],
        },
        {"_id": 1, "user_email": 1, "created_by": 1},
    ).to_list(None)

    for row in task_rows:
        fallback_owner = row.get("user_email") or row.get("created_by")
        if not fallback_owner:
            continue
        await reports.update_one(
            {"_id": row["_id"]},
            {
                "$set": {
                    "assigned_to": [str(fallback_owner).lower()],
                    "updated_at": datetime.utcnow(),
                }
            },
        )