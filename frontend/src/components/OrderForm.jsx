import { useState } from 'react'
import { fmtPrice } from '../utils/format'

const emptyRow = () => ({ name: '', qty: '1', price: '' })

export default function OrderForm({ onSubmit, onCancel, submitting }) {
  const [rows, setRows] = useState([emptyRow()])
  const [errors, setErrors] = useState({})

  const updateRow = (i, field, value) => {
    setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))
  }

  const removeRow = (i) => {
    if (rows.length === 1) return
    setRows((prev) => prev.filter((_, idx) => idx !== i))
  }

  const total = rows.reduce(
    (sum, row) => sum + (parseFloat(row.price) || 0) * (parseInt(row.qty) || 0),
    0,
  )

  const validate = () => {
    const newErrors = {}
    rows.forEach((row, i) => {
      if (!row.name.trim()) newErrors[`name_${i}`] = true
      if (!row.qty || parseInt(row.qty) <= 0) newErrors[`qty_${i}`] = true
      if (!row.price || parseFloat(row.price) <= 0) newErrors[`price_${i}`] = true
    })
    return newErrors
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = validate()
    if (Object.keys(newErrors).length) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    const items = rows.map((row) => ({
      product_name: row.name.trim(),
      quantity: parseInt(row.qty),
      price: parseFloat(row.price),
    }))
    onSubmit(items)
  }

  return (
    <form onSubmit={handleSubmit}>
      <table className="order-form-table">
        <thead>
          <tr>
            <th style={{ width: '45%' }}>Product name</th>
            <th style={{ width: '12%' }}>Qty</th>
            <th style={{ width: '22%' }}>Unit price</th>
            <th style={{ width: '21%' }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateRow(i, 'name', e.target.value)}
                  placeholder="Product name"
                  className={errors[`name_${i}`] ? 'has-error' : ''}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="1"
                  value={row.qty}
                  onChange={(e) => updateRow(i, 'qty', e.target.value)}
                  className={errors[`qty_${i}`] ? 'has-error' : ''}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={row.price}
                  onChange={(e) => updateRow(i, 'price', e.target.value)}
                  placeholder="0.00"
                  className={errors[`price_${i}`] ? 'has-error' : ''}
                />
              </td>
              <td style={{ textAlign: 'right' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  style={{ opacity: rows.length === 1 ? 0.3 : 1 }}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => setRows((r) => [...r, emptyRow()])}
      >
        + Add item
      </button>

      <div className="order-form-bottom">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span className="order-form-total">Total: {fmtPrice(total)}</span>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Placing…' : 'Place Order'}
          </button>
        </div>
      </div>
    </form>
  )
}
