from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from bson import ObjectId
from fastapi import HTTPException

from app.db import audit_logs, projects, users

PRIVILEGED_ROLES: Set[str] = {"admin", "project_manager"}


def is_privileged_role(role: Optional[str]) -> bool:
    return str(role or "").lower() in PRIVILEGED_ROLES


def _normalize_email_list(values: Any) -> List[str]:
    if values is None:
        return []
    if isinstance(values, str):
        values = [values]
    if not isinstance(values, list):
        return []
    normalized: List[str] = []
    seen = set()
    for value in values:
        email = str(value or "").strip().lower()
        if not email or email in seen:
            continue
        seen.add(email)
        normalized.append(email)
    return normalized


def project_member_emails(project_doc: Dict[str, Any]) -> Set[str]:
    emails: Set[str] = set()

    for member in project_doc.get("members", []) or []:
        email = str(member.get("email") or "").strip().lower()
        if email:
            emails.add(email)

    for email in _normalize_email_list(project_doc.get("team_members")):
        emails.add(email)

    manager_email = str(project_doc.get("project_manager_email") or "").strip().lower()
    if manager_email:
        emails.add(manager_email)

    return emails


def can_access_project(project_doc: Dict[str, Any], user: Dict[str, Any]) -> bool:
    if is_privileged_role(user.get("role")):
        return True

    user_email = str(user.get("email") or "").strip().lower()
    if not user_email:
        return False

    return user_email in project_member_emails(project_doc)


async def require_project_access(project_doc: Dict[str, Any], user: Dict[str, Any]) -> None:
    if can_access_project(project_doc, user):
        return
    raise HTTPException(status_code=403, detail="You do not have access to this project")


async def require_admin_access(user: Dict[str, Any]) -> None:
    if is_privileged_role(user.get("role")):
        return
    raise HTTPException(status_code=403, detail="Admin access required")


async def get_accessible_project_ids(user: Dict[str, Any]) -> List[str]:
    if is_privileged_role(user.get("role")):
        rows = await projects.find({}, {"_id": 1}).to_list(None)
        return [str(row["_id"]) for row in rows if row.get("_id")]

    user_email = str(user.get("email") or "").strip().lower()
    if not user_email:
        return []

    rows = await projects.find(
        {
            "$or": [
                {"members.email": user_email},
                {"team_members": user_email},
                {"project_manager_email": user_email},
            ]
        },
        {"_id": 1},
    ).to_list(None)
    return [str(row["_id"]) for row in rows if row.get("_id")]


async def can_view_task(task_doc: Dict[str, Any], user: Dict[str, Any]) -> bool:
    if is_privileged_role(user.get("role")):
        return True

    project_id = str(task_doc.get("project_id") or "").strip()
    if not project_id:
        return False

    accessible_project_ids = await get_accessible_project_ids(user)
    if project_id not in set(accessible_project_ids):
        return False

    user_email = str(user.get("email") or "").strip().lower()
    assigned = _normalize_email_list(task_doc.get("assigned_to"))
    return user_email in assigned


async def require_task_view_access(task_doc: Dict[str, Any], user: Dict[str, Any]) -> None:
    allowed = await can_view_task(task_doc, user)
    if allowed:
        return
    raise HTTPException(status_code=403, detail="You do not have access to this task")


async def build_task_query_for_user(user: Dict[str, Any], base_query: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    query: Dict[str, Any] = dict(base_query or {})

    if is_privileged_role(user.get("role")):
        return query

    project_ids = await get_accessible_project_ids(user)
    if not project_ids:
        query["_id"] = {"$exists": False}
        return query

    query["project_id"] = {"$in": project_ids}
    query["assigned_to"] = str(user.get("email") or "").strip().lower()
    return query


async def validate_users_exist(emails: List[str]) -> None:
    if not emails:
        return

    rows = await users.find({"email": {"$in": emails}}, {"email": 1}).to_list(None)
    existing = {str(row.get("email") or "").strip().lower() for row in rows}
    missing = [email for email in emails if email not in existing]
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown user emails: {', '.join(missing)}")


async def validate_task_assignment(project_doc: Dict[str, Any], assigned_to: List[str]) -> List[str]:
    normalized = _normalize_email_list(assigned_to)
    if not normalized:
        raise HTTPException(status_code=400, detail="Tasks must be assigned to at least one user")

    await validate_users_exist(normalized)

    project_member_set = project_member_emails(project_doc)
    invalid = [email for email in normalized if email not in project_member_set]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Assignees must be project members: {', '.join(invalid)}",
        )

    return normalized


async def append_audit_log(
    action: str,
    actor: Dict[str, Any],
    entity_type: str,
    entity_id: str,
    changes: Optional[Dict[str, Any]] = None,
) -> None:
    if not is_privileged_role(actor.get("role")):
        return

    await audit_logs.insert_one(
        {
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "actor_email": actor.get("email"),
            "actor_role": actor.get("role"),
            "changes": changes or {},
            "created_at": datetime.utcnow(),
        }
    )


def to_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid ID format") from exc
