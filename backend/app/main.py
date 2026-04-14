from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import auth_routes, report_routes, chat_routes, request_routes, project_routes, daily_plan_routes
from app.db import ensure_indexes, ensure_rbac_backfill
from app.middleware import attach_auth_context

app = FastAPI(title="Project Management Backend")
app.middleware("http")(attach_auth_context)

# CORS (needed for frontend later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth_routes.router, prefix="/api")
app.include_router(report_routes.router, prefix="/api")
app.include_router(chat_routes.router, prefix="/api")
app.include_router(request_routes.router, prefix="/api")
app.include_router(project_routes.router, prefix="/api")
app.include_router(daily_plan_routes.router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    await ensure_indexes()
    await ensure_rbac_backfill()

@app.get("/")
def root():
    return {"status": "Backend is running"}
