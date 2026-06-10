import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navLinkClass = ({ isActive }) => `nav-link ${isActive ? 'active' : ''}`

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const isAdmin = user.role === 'admin'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <span className="navbar-brand">⬡ Orders</span>
      <div className="navbar-links">
        {isAdmin ? (
          <>
            <NavLink to="/admin/orders" className={navLinkClass}>All Orders</NavLink>
            <NavLink to="/admin/users" className={navLinkClass}>Users</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/orders" end className={navLinkClass}>My Orders</NavLink>
            <NavLink to="/orders/new" className={navLinkClass}>New Order</NavLink>
          </>
        )}
      </div>
      <div className="navbar-right">
        <span className="navbar-email">{user.email}</span>
        <span className={`role-badge ${user.role}`}>{user.role}</span>
        <button className="nav-logout" onClick={handleLogout}>Log out</button>
      </div>
    </nav>
  )
}
