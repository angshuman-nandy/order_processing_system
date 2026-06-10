import { createContext, useContext, useEffect, useState } from 'react'
import { getCurrentUser, login as loginRequest } from '../api/orders'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(null) // { id, email, role, created_at }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    getCurrentUser()
      .then(({ data }) => setUser(data))
      .catch(() => {
        localStorage.removeItem('token')
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const { data } = await loginRequest(email, password)
    localStorage.setItem('token', data.access_token)
    setToken(data.access_token)
    const { data: me } = await getCurrentUser()
    setUser(me)
    return me
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
