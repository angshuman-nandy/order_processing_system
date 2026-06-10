from __future__ import annotations

import argparse
import json
import sys
from decimal import Decimal
from pathlib import Path
from uuid import UUID

SEED_DATA_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SEED_DATA_DIR.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy.orm import Session  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.enums import OrderStatus, UserRole  # noqa: E402
from app.models import Order, OrderItem, User  # noqa: E402
from app.security import hash_password  # noqa: E402


def load_json(filename: str) -> list[dict]:
    with open(SEED_DATA_DIR / filename) as seed_file:
        return json.load(seed_file)


def seed_users(db: Session, users_data: list[dict]) -> None:
    for user_data in users_data:
        if db.get(User, UUID(user_data["id"])) is not None:
            print(f"User {user_data['email']} already exists, skipping.")
            continue
        db.add(
            User(
                id=UUID(user_data["id"]),
                email=user_data["email"],
                hashed_password=hash_password(user_data["password"]),
                role=UserRole(user_data["role"]),
            )
        )
        print(f"Added user {user_data['email']} ({user_data['role']}).")
    db.commit()


def seed_orders(db: Session, orders_data: list[dict]) -> None:
    for order_data in orders_data:
        if db.get(Order, UUID(order_data["id"])) is not None:
            print(f"Order {order_data['id']} already exists, skipping.")
            continue
        db.add(
            Order(
                id=UUID(order_data["id"]),
                user_id=UUID(order_data["user_id"]),
                status=OrderStatus(order_data["status"]),
            )
        )
        print(f"Added order {order_data['id']} ({order_data['status']}).")
    db.commit()


def seed_order_items(db: Session, order_items_data: list[dict]) -> None:
    for item_data in order_items_data:
        if db.get(OrderItem, UUID(item_data["id"])) is not None:
            print(f"Order item {item_data['id']} already exists, skipping.")
            continue
        db.add(
            OrderItem(
                id=UUID(item_data["id"]),
                order_id=UUID(item_data["order_id"]),
                product_name=item_data["product_name"],
                quantity=item_data["quantity"],
                price=Decimal(item_data["price"]),
            )
        )
        print(f"Added order item '{item_data['product_name']}' for order {item_data['order_id']}.")
    db.commit()


def promote_to_admin(db: Session, email: str) -> None:
    user = db.query(User).filter(User.email == email).one_or_none()
    if user is None:
        print(f"No user found with email {email}.")
        return
    if user.role == UserRole.admin:
        print(f"User {email} is already an admin.")
        return
    user.role = UserRole.admin
    db.commit()
    print(f"Promoted {email} to admin.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the database with sample data.")
    parser.add_argument(
        "--promote-admin",
        nargs="?",
        const="",
        default=None,
        metavar="EMAIL",
        help=(
            "Promote a customer to admin instead of seeding. If EMAIL is omitted, "
            "promotes the customer user from users_seed_data.json."
        ),
    )
    args = parser.parse_args()

    with SessionLocal() as db:
        if args.promote_admin is not None:
            email = args.promote_admin
            if not email:
                users_data = load_json("users_seed_data.json")
                email = next(u["email"] for u in users_data if u["role"] == "customer")
            promote_to_admin(db, email)
            return

        seed_users(db, load_json("users_seed_data.json"))
        seed_orders(db, load_json("orders_seed_data.json"))
        seed_order_items(db, load_json("order_items_seed_data.json"))


if __name__ == "__main__":
    main()
