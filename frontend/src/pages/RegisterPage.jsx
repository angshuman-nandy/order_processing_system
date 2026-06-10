import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { register } from '../api/orders'

export default function RegisterPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const validate = () => {
    const newErrors = {}
    if (!email) newErrors.email = 'Email is required.'
    if (password.length < 8) newErrors.password = 'Password must be at least 8 characters.'
    if (password !== confirm) newErrors.confirm = 'Passwords do not match.'
    return newErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = validate()
    if (Object.keys(newErrors).length) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    setLoading(true)
    try {
      await register(email, password)
      await login(email, password)
      navigate('/orders')
    } catch (err) {
      const detail = err?.response?.data?.detail
      let message = 'Registration failed.'
      if (typeof detail === 'string') message = detail
      else if (Array.isArray(detail) && detail[0]?.msg) message = detail[0].msg
      setErrors({ email: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-title">Create account</div>
        <div className="auth-sub">Customers only — admins are pre-provisioned</div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={errors.email ? 'has-error' : ''}
            />
            {errors.email && <span className="error-msg">{errors.email}</span>}
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className={errors.password ? 'has-error' : ''}
            />
            {errors.password && <span className="error-msg">{errors.password}</span>}
          </div>
          <div className="field">
            <label>Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              className={errors.confirm ? 'has-error' : ''}
            />
            {errors.confirm && <span className="error-msg">{errors.confirm}</span>}
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
