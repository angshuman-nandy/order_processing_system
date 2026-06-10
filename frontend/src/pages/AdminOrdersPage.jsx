import { useCallback, useEffect, useState } from 'react'
import OrderCard from '../components/OrderCard'
import StatusFilter from '../components/StatusFilter'
import { addToast } from '../components/Toast'
import { getOrders } from '../api/orders'

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')

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

  return (
    <div className="page">
      <h1 className="page-title">All Orders</h1>
      <div className="filter-bar">
        <StatusFilter value={filter} onChange={setFilter} />
        {!loading && (
          <span className="orders-count">
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <>
          <div className="skeleton skeleton-card"></div>
          <div className="skeleton skeleton-card"></div>
          <div className="skeleton skeleton-card"></div>
        </>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No orders found</h3>
          <p>Try a different status filter.</p>
        </div>
      ) : (
        orders.map((order) => <OrderCard key={order.id} order={order} isAdmin />)
      )}
    </div>
  )
}
