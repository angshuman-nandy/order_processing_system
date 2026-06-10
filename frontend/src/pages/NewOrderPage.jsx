import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OrderForm from '../components/OrderForm'
import { addToast } from '../components/Toast'
import { createOrder } from '../api/orders'

export default function NewOrderPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (items) => {
    setSubmitting(true)
    try {
      const { data: order } = await createOrder(items)
      addToast('Order placed!', 'success')
      navigate('/orders', { state: { newOrderId: order.id } })
    } catch {
      addToast('Failed to place order. Try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">New Order</h1>
      <div className="card">
        <OrderForm
          onSubmit={handleSubmit}
          onCancel={() => navigate('/orders')}
          submitting={submitting}
        />
      </div>
    </div>
  )
}
