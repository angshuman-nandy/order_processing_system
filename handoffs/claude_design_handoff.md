# Claude Design Handoff — Order Processing Frontend

## What you are building

A React + Vite web app for an e-commerce order processing system. It has two distinct user types — **customers** and **admins** — with entirely different views and permissions. The app is served via Nginx; all API calls go to `/api/*`.

---

## Auth state — three distinct app states

```
┌─────────────────────────────────────────────────────┐
│                    App shell                        │
├──────────────┬──────────────────┬───────────────────┤
│  Unauthenticated  │  Customer view  │   Admin view    │
│  /login           │  /orders        │  /admin/orders  │
│  /register        │  /orders/new    │  /admin/users   │
└──────────────┴──────────────────┴───────────────────┘
```

The app should redirect unauthenticated users to `/login`. After login, redirect by role — customer → `/orders`, admin → `/admin/orders`.

---

## Component tree

```
App
├── AuthContext.jsx              (token + current user in React context)
├── PrivateRoute.jsx             (redirects to /login if no token)
├── AdminRoute.jsx               (redirects to /orders if not admin)
│
├── pages/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── CustomerOrdersPage.jsx
│   ├── NewOrderPage.jsx
│   ├── AdminOrdersPage.jsx
│   └── AdminUsersPage.jsx
│
└── components/
    ├── Navbar.jsx               (shows email + role badge + logout)
    ├── OrderCard.jsx            (single order: status badge, items, cancel btn)
    ├── OrderForm.jsx            (dynamic line items, place order)
    ├── StatusBadge.jsx          (colour-coded pill per status)
    ├── StatusFilter.jsx         (dropdown: ALL / PENDING / PROCESSING / etc.)
    └── AdminStatusPatch.jsx     (admin-only dropdown to change status)
```

---

## API integration

Install: `axios`

### `api/orders.js`
```javascript
import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:8000' })

// Attach JWT to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const login = (email, password) =>
  api.post('/auth/token', new URLSearchParams({ username: email, password }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })

export const register = (email, password) =>
  api.post('/auth/register', { email, password })

export const getOrders = (status) =>
  api.get('/orders', { params: status ? { status } : {} })

export const createOrder = (items) =>
  api.post('/orders', { items })

export const cancelOrder = (id) =>
  api.delete(`/orders/${id}/cancel`)

export const updateOrderStatus = (id, status) =>
  api.patch(`/orders/${id}/status`, { status })

export const getUsers = () =>
  api.get('/users')
```

**Important:** The `/auth/token` endpoint expects an OAuth2 form body (`application/x-www-form-urlencoded`) with `username` and `password` fields. Not JSON. Use `URLSearchParams`.

---

## AuthContext

```jsx
// context/AuthContext.jsx
const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(null)    // { id, email, role }

  const loginFn = async (email, password) => {
    const { data } = await login(email, password)
    localStorage.setItem('token', data.access_token)
    setToken(data.access_token)
    // decode JWT payload to get role without an extra round-trip
    const payload = JSON.parse(atob(data.access_token.split('.')[1]))
    setUser({ role: payload.role, email })
  }

  const logoutFn = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, login: loginFn, logout: logoutFn }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
```

---

## Status badge colours

Use these consistently everywhere a status is shown:

| Status | Colour intent | Suggested Tailwind |
|---|---|---|
| PENDING | Neutral / waiting | `bg-gray-100 text-gray-700` |
| PROCESSING | Active / in progress | `bg-blue-100 text-blue-700` |
| SHIPPED | On its way | `bg-purple-100 text-purple-700` |
| DELIVERED | Done / success | `bg-green-100 text-green-700` |
| CANCELLED | Terminal / muted | `bg-red-100 text-red-600` |

---

## Customer view — pages and behaviour

### `/login` and `/register`
- Simple centred card, email + password fields
- On success: store token, redirect by role
- Show field-level errors from API (422 validation, 401 wrong credentials)
- Register always creates a `customer` account — no role picker

### `/orders` — My Orders
- Fetch `GET /api/orders` on mount and every 10 seconds (poll for status changes)
- Status filter dropdown at the top (All / PENDING / PROCESSING / SHIPPED / DELIVERED / CANCELLED)
- Each order rendered as an `OrderCard`
- Empty state: "You haven't placed any orders yet. Place your first order →"
- Loading state: skeleton cards, not a spinner blocking the whole page

### `OrderCard` — customer view
```
┌──────────────────────────────────────────┐
│ Order #8f3a...   [PENDING]               │
│ Placed 12 Jun 2026, 14:32                │
│                                          │
│  2× Running Shoes         £89.99         │
│  1× Water Bottle          £14.99         │
│                                          │
│  Total: £194.97                          │
│                              [Cancel]    │
└──────────────────────────────────────────┘
```
- Cancel button: visible only if status is `PENDING`. Disabled + greyed for all other statuses.
- On cancel: optimistic UI — immediately show as CANCELLED, revert on API error.
- Show short order ID (first 8 chars of UUID is fine).

### `/orders/new` — New Order
```
┌─────────────────────────────────────────────┐
│  New Order                                  │
│                                             │
│  Product name    Qty    Unit price          │
│  ──────────────  ───    ──────────          │
│  [____________]  [ 1]   [£ ______]   [✕]   │
│  [____________]  [ 1]   [£ ______]   [✕]   │
│                                             │
│  [+ Add item]                               │
│                                             │
│  Total: £0.00                               │
│                         [Place Order]       │
└─────────────────────────────────────────────┘
```
- Start with one item row; "+ Add item" appends another.
- Show live total as user types prices/quantities.
- Validate: product name required, qty > 0, price > 0.
- On success: redirect to `/orders` and highlight the new order briefly.
- Minimum 1 item required (API enforces this too; show error if somehow submitted empty).

---

## Admin view — pages and behaviour

### `/admin/orders` — All Orders
Same layout as customer orders list but:
- Shows **all orders** from all customers, with customer email visible on each card
- Status filter works the same way
- Each card has an `AdminStatusPatch` dropdown instead of a Cancel button
- No "Place Order" button

### `OrderCard` — admin additions
```
┌──────────────────────────────────────────────────┐
│ Order #8f3a...   [PROCESSING]    jane@email.com  │
│ Placed 12 Jun 2026, 14:32                        │
│                                                  │
│  2× Running Shoes          £89.99                │
│                                                  │
│  Status: [PROCESSING ▾]                          │
└──────────────────────────────────────────────────┘
```
Status dropdown options: PENDING / PROCESSING / SHIPPED / DELIVERED (not CANCELLED — cancellation is a customer action only).

### `/admin/users` — Users
Simple table:
```
Email                  Role       Joined
────────────────────   ────────   ──────────────
jane@example.com       customer   12 Jun 2026
admin@example.com      admin      01 Jan 2026
```
Read-only. No role editing needed for this assignment.

---

## Navbar

```
[Logo / Order System]          jane@example.com  [customer]  [Log out]
```
- Show role as a small badge next to email
- Admin navbar: add "All Orders" and "Users" nav links
- Customer navbar: "My Orders" and "New Order"

---

## Polling strategy

Use `setInterval` in a `useEffect` with cleanup:

```jsx
useEffect(() => {
  fetchOrders()                          // immediate fetch on mount
  const id = setInterval(fetchOrders, 10_000)   // then every 10s
  return () => clearInterval(id)         // cleanup on unmount
}, [statusFilter])
```

This is sufficient for the assignment. No websockets needed.

---

## Error handling conventions

| Situation | What to show |
|---|---|
| 401 on any request | Auto-redirect to `/login` (handled in Axios interceptor) |
| 403 | Toast: "You don't have permission to do that" |
| 400 on cancel | Toast: "Only pending orders can be cancelled" |
| 422 on form submit | Highlight the offending fields with inline error text |
| Network error | Toast: "Something went wrong. Try again." |
| Empty order list | Empty state illustration + CTA, not an error |

Use a simple toast system (React hot toast or hand-rolled with `useState` + `setTimeout`).

---

## Routing

Use React Router v6:

```jsx
<Routes>
  <Route path="/login"    element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />

  <Route element={<PrivateRoute />}>
    <Route path="/orders"     element={<CustomerOrdersPage />} />
    <Route path="/orders/new" element={<NewOrderPage />} />
  </Route>

  <Route element={<AdminRoute />}>
    <Route path="/admin/orders" element={<AdminOrdersPage />} />
    <Route path="/admin/users"  element={<AdminUsersPage />} />
  </Route>

  <Route path="*" element={<Navigate to="/login" />} />
</Routes>
```

After login, redirect by role:
```javascript
user.role === 'admin' ? navigate('/admin/orders') : navigate('/orders')
```

---

## Vite config

```javascript
// vite.config.js — no proxy needed, API is called directly on port 8000
export default defineConfig({
  plugins: [react()],
})
```

---

## Running the frontend

The frontend runs outside Docker via Vite's dev server:

```bash
cd frontend
npm install
npm run dev        # starts on http://localhost:5173
```

The Docker Compose stack (db, redis, api, worker) runs separately. The Vite dev server calls the API directly at `http://localhost:8000`.

---

## Design notes

Keep the UI functional and clear — this is an internal/ops tool, not a consumer storefront. Priorities in order:

1. Status is always visible and colour-coded
2. The customer can never accidentally see or act on another customer's orders
3. Admin actions (status patch) are clearly distinct from customer actions (cancel)
4. Empty states and loading states should not look broken

Suggested stack additions if you want a polished look with minimal effort: `@headlessui/react` for the status dropdown, `react-hot-toast` for toasts, TailwindCSS for styling.