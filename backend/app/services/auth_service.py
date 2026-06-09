from __future__ import annotations

from sqlalchemy.orm import Session

from app.enums import UserRole
from app.exceptions import AuthError, BadRequestError
from app.models import User
from app.schemas import Token, UserCreate
from app.security import create_access_token, hash_password, verify_password


def register_customer(db: Session, body: UserCreate) -> User:
    if db.query(User).filter(User.email == body.email).first():
        raise BadRequestError("Email already registered")
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        role=UserRole.customer,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login(db: Session, username: str, password: str) -> Token:
    user = db.query(User).filter(User.email == username).first()
    if not user or not verify_password(password, user.hashed_password):
        raise AuthError("Incorrect email or password")
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return Token(access_token=token)
