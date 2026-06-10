import { useEffect, useState } from 'react'
import { addToast } from '../components/Toast'
import { getUsers } from '../api/orders'
import { formatDateShort } from '../utils/format'

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUsers()
      .then(({ data }) => setUsers(data))
      .catch(() => addToast('Failed to load users.', 'error'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page">
      <h1 className="page-title">Users</h1>
      <div className="card data-table-wrap" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24 }}>
            <div className="skeleton" style={{ height: 20, marginBottom: 12 }}></div>
            <div className="skeleton" style={{ height: 20, marginBottom: 12 }}></div>
            <div className="skeleton" style={{ height: 20 }}></div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.email}</td>
                  <td>
                    <span className={`role-badge ${u.role}`}>{u.role}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{formatDateShort(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
