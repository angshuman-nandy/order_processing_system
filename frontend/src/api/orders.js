import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:8000' })

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export const login = (email, password) =>
  api.post('/auth/token', new URLSearchParams({ username: email, password }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

export const register = (email, password) => api.post('/auth/register', { email, password })

export const getCurrentUser = () => api.get('/users/me')

export const getOrders = (status) => api.get('/orders', { params: status ? { status } : {} })

export const createOrder = (items) => api.post('/orders', { items })

export const cancelOrder = (id) => api.delete(`/orders/${id}/cancel`)

export const updateOrderStatus = (id, status) => api.patch(`/orders/${id}/status`, { status })

export const getUsers = () => api.get('/users')
