import { useCallback, useState } from 'react'

const _toastRef = { add: null }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const add = useCallback((msg, type = 'info') => {
    const id = Date.now()
    setToasts((t) => [...t, { id, msg, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  _toastRef.add = add

  return (
    <>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'error' ? '✕' : t.type === 'success' ? '✓' : 'ℹ'} {t.msg}
          </div>
        ))}
      </div>
    </>
  )
}

export function addToast(msg, type = 'info') {
  if (_toastRef.add) _toastRef.add(msg, type)
}
