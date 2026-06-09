from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import User


def list_users(db: Session) -> list[User]:
    return db.query(User).all()
