from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import certifi
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