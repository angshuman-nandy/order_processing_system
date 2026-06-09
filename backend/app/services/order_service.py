from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.enums import OrderStatus, UserRole
from app.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.models import Order, OrderItem, User
from app.schemas import OrderCreate
from app.tasks import auto_process_order

_ORDER_LOAD = [joinedload(Order.items), joinedload(Order.owner)]


def _get_order_or_404(db: Session, order_id: UUID) -> Order:
    order = db.get(Order, order_id, options=_ORDER_LOAD)
    if not order:
        raise NotFoundError("Order not found")
    return order


def create_order(db: Session, current_user: User, body: OrderCreate) -> Order:
    order = Order(user_id=current_user.id)
    db.add(order)
    db.flush()
    for item in body.items:
        db.add(OrderItem(order_id=order.id, **item.model_dump()))
    db.commit()
    order = db.get(Order, order.id, options=_ORDER_LOAD)
    auto_process_order.apply_async(args=[str(order.id)], countdown=300)
    return order


def list_orders(db: Session, current_user: User, status: OrderStatus | None) -> list[Order]:
    q = select(Order).options(*_ORDER_LOAD)
    if current_user.role != UserRole.admin:
        q = q.where(Order.user_id == current_user.id)
    if status:
        q = q.where(Order.status == status)
    return db.execute(q).unique().scalars().all()


def get_order_for_user(db: Session, order_id: UUID, current_user: User) -> Order:
    order = _get_order_or_404(db, order_id)
    if current_user.role != UserRole.admin and order.user_id != current_user.id:
        raise ForbiddenError("Not your order")
    return order


def update_status(db: Session, order_id: UUID, new_status: OrderStatus) -> Order:
    order = _get_order_or_404(db, order_id)
    order.status = new_status
    db.commit()
    db.refresh(order)
    return order


def cancel_order(db: Session, order_id: UUID, current_user: User) -> Order:
    order = _get_order_or_404(db, order_id)
    if current_user.role == UserRole.customer and order.user_id != current_user.id:
        raise ForbiddenError("Not your order")
    if order.status != OrderStatus.PENDING:
        raise BadRequestError("Only PENDING orders can be cancelled")
    order.status = OrderStatus.CANCELLED
    db.commit()
    db.refresh(order)
    return order
