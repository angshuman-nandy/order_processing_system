from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.enums import OrderStatus, UserRole


# --- Auth / User ---

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class UserResponse(BaseModel):
    id: UUID
    email: str
    role: UserRole
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    sub: str
    role: UserRole


# --- Order items ---

class OrderItemCreate(BaseModel):
    product_name: str
    quantity: int = Field(gt=0)
    price: Decimal = Field(gt=0, decimal_places=2)


class OrderItemResponse(BaseModel):
    id: UUID
    product_name: str
    quantity: int
    price: Decimal
    model_config = ConfigDict(from_attributes=True)


# --- Orders ---

class OrderCreate(BaseModel):
    items: list[OrderItemCreate] = Field(min_length=1)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderOwner(BaseModel):
    email: str
    model_config = ConfigDict(from_attributes=True)


class OrderResponse(BaseModel):
    id: UUID
    user_id: UUID
    status: OrderStatus
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemResponse]
    owner: OrderOwner
    model_config = ConfigDict(from_attributes=True)
