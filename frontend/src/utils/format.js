export const STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']
export const ADMIN_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED']

export function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function formatDateShort(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function calcTotal(items) {
  return items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
}

export function fmtPrice(n) {
  return '£' + n.toFixed(2)
}

export function shortId(id) {
  return '#' + id.slice(0, 8).toUpperCase()
}
