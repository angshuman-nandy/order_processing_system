import { useState } from 'react'
import { ADMIN_STATUSES } from '../utils/format'
import { updateOrderStatus } from '../api/orders'
import { addToast } from './Toast'

export default function AdminStatusPatch({ orderId, status, onStatusChange }) {
  const [saving, setSaving] = useState(false)

  const handleChange = async (newStatus) => {
    const previous = status
    onStatusChange(newStatus)
    setSaving(true)
    try {
      await updateOrderStatus(orderId, newStatus)
      addToast(`Status updated to ${newStatus}`, 'success')
    } catch {
      onStatusChange(previous)
      addToast('Failed to update status.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="inline-status-wrap">
      <label>Status</label>
      <select
        className="status-select"
        value={status}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving || status === 'CANCELLED'}
      >
        {ADMIN_STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
        {status === 'CANCELLED' && <option value="CANCELLED">CANCELLED</option>}
      </select>
      {saving && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saving…</span>}
      {status === 'CANCELLED' && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cancelled by customer</span>
      )}
    </div>
  )
}
