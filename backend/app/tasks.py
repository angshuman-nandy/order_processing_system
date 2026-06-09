from __future__ import annotations

import os

from celery import Celery
from dotenv import find_dotenv, load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

load_dotenv(find_dotenv())

celery_app = Celery(
    "order_tasks",
    broker=os.environ["REDIS_URL"],
    backend=os.environ["REDIS_URL"],
)

engine = create_engine(os.environ["DATABASE_URL"])


@celery_app.task(acks_late=True, bind=True, max_retries=3)
def auto_process_order(self, order_id: str) -> None:
    from app.enums import OrderStatus
    from app.models import Order

    with Session(engine) as db:
        order = db.get(Order, order_id)
        if not order:
            return
        if order.status != OrderStatus.PENDING:
            return
        order.status = OrderStatus.PROCESSING
        db.commit()
