import { useEffect, useState } from 'react'
import StatusBadge from './StatusBadge'
import AdminStatusPatch from './AdminStatusPatch'
import { calcTotal, fmtPrice, formatDate, shortId } from '../utils/format'

export default function OrderCard({ order, highlight, isAdmin, onCancel, onStatusChange }) {
  const [status, setStatus] = useState(order.status)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => setStatus(order.status), [order.status])

  const total = calcTotal(order.items)

  const handleCancel = async () => {
    setCancelling(true)
    await onCancel(order.id)
    setCancelling(false)
  }

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus)
    onStatusChange?.(order.id, newStatus)
  }

  return (
    <div className={`order-card ${highlight ? 'highlight' : ''}`}>
      <div className="order-card-header">
        <span className="order-id">{shortId(order.id)}</span>
        <StatusBadge status={status} />
        {isAdmin && <span className="order-email">{order.owner.email}</span>}
        <span className="order-date">{formatDate(order.created_at)}</span>
      </div>
      <div className="order-items">
        {order.items.map((item) => (
          <div className="order-item" key={item.id}>
            <span className="item-name">{item.quantity}× {item.product_name}</span>
            <span>{fmtPrice(Number(item.price) * item.quantity)}</span>
          </div>
        ))}
        <div className="order-total">{fmtPrice(total)}</div>
      </div>
      {isAdmin ? (
        <AdminStatusPatch orderId={order.id} status={status} onStatusChange={handleStatusChange} />
      ) : (
        <div className="order-footer">
          {status === 'PENDING' ? (
            <button className="btn btn-danger btn-sm" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Cancel order'}
            </button>
          ) : (
            <button className="btn btn-ghost btn-sm" disabled>Cancel order</button>
          )}
        </div>
      )}
    </div>
  )
}
