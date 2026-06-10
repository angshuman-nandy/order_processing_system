import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import OrderCard from '../components/OrderCard'
import StatusFilter from '../components/StatusFilter'
import { addToast } from '../components/Toast'
import { cancelOrder, getOrders } from '../api/orders'

export default function CustomerOrdersPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [highlightId, setHighlightId] = useState(location.state?.newOrderId ?? null)

  const fetchOrders = useCallback(async () => {
    try {
      const { data } = await getOrders(filter === 'ALL' ? null : filter)
      setOrders(data)
    } catch {
      addToast('Failed to load orders.', 'error')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    setLoading(true)
    fetchOrders()
    const id = setInterval(fetchOrders, 10000)
    return () => clearInterval(id)
  }, [fetchOrders])

  useEffect(() => {
    if (!highlightId) return
    const timeout = setTimeout(() => setHighlightId(null), 3000)
    return () => clearTimeout(timeout)
  }, [highlightId])

  const handleCancel = async (id) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: 'CANCELLED' } : o)))
    try {
      await cancelOrder(id)
      addToast('Order cancelled.', 'success')
    } catch (err) {
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: 'PENDING' } : o)))
      const status = err?.response?.status
      addToast(
        status === 400 ? 'Only pending orders can be cancelled.' : 'Something went wrong.',
        'error',
      )
    }
  }

  const filtered = filter === 'ALL' ? orders : orders.filter((o) => o.status === filter)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">My Orders</h1>
        <button className="btn btn-primary" onClick={() => navigate('/orders/new')}>
          + New Order
        </button>
      </div>

      <div className="filter-bar">
        <StatusFilter value={filter} onChange={setFilter} />
        {!loading && (
          <span className="orders-count">
            {filtered.length} order{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <>
          <div className="skeleton skeleton-card"></div>
          <div className="skeleton skeleton-card"></div>
          <div className="skeleton skeleton-card"></div>
        </>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>{filter === 'ALL' ? 'No orders yet' : `No ${filter.toLowerCase()} orders`}</h3>
          <p>{filter === 'ALL' ? "You haven't placed any orders yet." : 'Try a different filter.'}</p>
          {filter === 'ALL' && (
            <button className="btn btn-primary" onClick={() => navigate('/orders/new')}>
              Place your first order →
            </button>
          )}
        </div>
      ) : (
        filtered.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onCancel={handleCancel}
            highlight={order.id === highlightId}
          />
        ))
      )}
    </div>
  )
}
