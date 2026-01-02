from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

client = AsyncIOMotorClient(MONGO_URI)
db = client["pm_app"]

users = db["users"]
projects = db["projects"]
tasks = db["tasks"]
reports = db["reports"]
chats = db["chats"]
