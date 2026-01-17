from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import certifi

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