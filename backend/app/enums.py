from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    customer = "customer"


class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
