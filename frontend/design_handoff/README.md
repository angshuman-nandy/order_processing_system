# Handoff: Order Processing System

## Overview
A full-featured order processing web app with two user roles — **customer** and **admin**. Customers place and cancel orders; admins manage all orders and view users. The design uses a warm color palette (orange, amber, red-brown) on an off-white background.

## About the Design Files
The files in this bundle (`prototype.html`) are **HTML design references** — a high-fidelity interactive prototype showing intended look, layout, and behavior. They are **not** production code to copy directly.

Your task is to **recreate these designs in the target codebase** using its existing framework, libraries, and patterns. Per the original handoff spec, the intended stack is **React + Vite + TailwindCSS**, with `axios` for API calls, `react-hot-toast` for toasts, and React Router v6 for routing. The prototype uses mock data in place of real API calls — replace those with the `axios` calls defined in the original handoff spec.

## Fidelity
**High-fidelity.** Colors, spacing, typography, component structure, interactions, loading states, error states, and empty states are all final. Recreate pixel-precisely using the design tokens below.

---

## Screens

### 1. Login — `/login`
**Purpose:** Authenticate returning users. Redirect by role on success.

**Layout:** Full-viewport centered flex container. Single card, `width: 340px`, `padding: 36px 32px`, `border-radius: 12px`, white background, `border: 1px solid #fed7aa`, `box-shadow: 0 4px 12px rgba(120,53,15,0.15)`.

**Components:**
- Title: `"Sign in"`, 20px, 700
- Subtitle: `"Order processing system"`, 13px, color `#9a3412`
- Email field + Password field (see Form Elements below)
- Submit button: full-width primary orange, text `"Sign in"` / `"Signing in…"` while loading
- Error message: inline below password field, 12px, `#dc2626`
- Auth footer link: `"No account? Register"` — navigates to `/register`

**Behavior:**
- `POST /auth/token` with `application/x-www-form-urlencoded` body (`username`, `password`)
- 401 → show `"Incorrect email or password."`
- Empty fields → show `"Please fill in all fields."`
- On success → decode JWT, redirect: admin → `/admin/orders`, customer → `/orders`

---

### 2. Register — `/register`
**Purpose:** Create a new customer account.

**Layout:** Identical card to Login.

**Components:**
- Title: `"Create account"`, subtitle: `"Customers only — admins are pre-provisioned"`
- Email, Password (min 6 chars), Confirm Password fields
- Submit button: `"Create account"` / `"Creating account…"`
- Inline field-level error messages

**Behavior:**
- Validate client-side first (empty, short password, mismatch)
- `POST /auth/register` → `{ email, password }`
- 422 with duplicate email → show `"Email already registered."` on email field
- On success → auto-login → redirect to `/orders`

---

### 3. Customer Orders — `/orders`
**Purpose:** Customer views and manages their own orders.

**Layout:** Page container `max-width: 860px`, centered, `padding: 32px 24px` (mobile: `20px 14px`). Page header row: title left, `"+ New Order"` primary button right.

**Components:**
- **Filter bar:** `<select>` with options: All / PENDING / PROCESSING / SHIPPED / DELIVERED / CANCELLED. Orders count label right-aligned (`"N orders"`).
- **Skeleton loading:** 3 × `height: 110px` animated shimmer cards (gradient `#fed7aa → #ffedd5 → #fed7aa`, 1.4s). Show instead of spinner.
- **Empty state:** centered, emoji icon `📦`, heading, paragraph, CTA button if filter is ALL.
- **Order cards:** see OrderCard below.

**Behavior:**
- `GET /orders` on mount, then polled every 10s (clear interval on unmount)
- Re-fetch when status filter changes
- Cancel: optimistic update (set CANCELLED immediately), revert on error

---

### 4. OrderCard — Customer
```
┌─────────────────────────────────────────────┐
│  #8F3A1B2C    [PENDING]       10 Jun, 14:32  │
│  ─────────────────────────────────────────  │
│  2× Running Shoes                   £179.98  │
│  1× Water Bottle                     £14.99  │
│                            Total: £194.97    │
│                               [Cancel order] │
└─────────────────────────────────────────────┘
```
- Card: `background: #fff`, `border: 1px solid #fed7aa`, `border-radius: 8px`, `padding: 16px 18px`, `box-shadow: 0 1px 3px rgba(120,53,15,0.12)`. Hover: `box-shadow: 0 4px 12px rgba(120,53,15,0.15)`.
- New order highlight: `border-color: #f97316`, `box-shadow: 0 0 0 2px rgba(249,115,22,0.2)`.
- Order ID: first 8 chars of UUID, uppercased, prefixed `#`, 13px, 700.
- Status badge: see Status Badges below.
- Date: 12px, `#9a3412`, right-aligned in header.
- Items section: `border-top: 1px solid #fed7aa`. Each row: name left, `qty× name` format; price right; 13px.
- Total row: `border-top: 1px solid #fed7aa`, right-aligned, 14px, 700.
- Cancel button: danger red, small (`padding: 5px 12px`, 12px font). Visible only if status === `PENDING`. If any other status: ghost button, disabled.

---

### 5. New Order — `/orders/new`
**Purpose:** Customer places a new order with dynamic line items.

**Layout:** Page title + white card with `padding: 20px`.

**Components:**
- Table with columns: **Product name** (45%), **Qty** (12%), **Unit price** (22%), action (21%)
- Each row: text input for name, number input for qty (min 1), number input for price (min 0.01, step 0.01), `✕` ghost button to remove row
- `"+ Add item"` outline button below table
- Footer bar: Cancel ghost button left; Total label + `"Place Order"` primary button right

**Behavior:**
- Start with 1 row. `"+ Add item"` appends another.
- Live total updates as user types.
- Validate on submit: name required, qty > 0, price > 0. Highlight offending inputs with `border-color: #dc2626`.
- `POST /orders` with `{ items: [{ name, qty, unit_price }] }`
- On success → redirect to `/orders`, highlight new card for ~3s.
- `"✕"` disabled when only 1 row remains.

**Mobile reflow (≤640px):** Table converts to a grid per row — name spans full width on first row; qty + price side by side + remove button on second row.

---

### 6. Admin Orders — `/admin/orders`
**Purpose:** Admin views and updates status of all orders from all customers.

**Layout:** Identical to Customer Orders page. No `"+ New Order"` button.

**Differences from Customer view:**
- Shows orders from all users (no `user_id` filter on `GET /orders`)
- Each card shows customer email in italic, 12px, `#9a3412`
- Instead of Cancel button: inline status dropdown (see AdminStatusPatch below)

**AdminStatusPatch:**
- Label `"Status"` + `<select>` with options: PENDING / PROCESSING / SHIPPED / DELIVERED (not CANCELLED — customer-only action)
- If current status is CANCELLED: show it in the select read-only + label `"Cancelled by customer"`
- On change: `PATCH /orders/{id}/status` with `{ status }`. Show `"Saving…"` text while in-flight.
- On success: toast `"Status updated to {STATUS}"`

---

### 7. Admin Users — `/admin/users`
**Purpose:** Read-only list of all registered users.

**Layout:** Page title + white card (no padding, `overflow: hidden`). Card contains a plain table.

**Table columns:** Email | Role | Joined
- Header row: 11px, 700, uppercase, `letter-spacing: 0.04em`, `#78350f`, `border-bottom: 2px solid #fed7aa`
- Data rows: 13px, `padding: 12px 14px`. Hover: `background: #fffbf7`
- Email: 500 weight
- Role: rendered as Role Badge (see below)
- Joined: formatted as `"12 Jun 2026"`, color `#9a3412`
- Mobile: card has `overflow-x: auto`, cells `white-space: nowrap`

---

## Navbar

```
⬡ Orders    [My Orders]  [New Order]    jane@example.com  [customer]  [Log out]
```

- Background: `#431407` (very dark warm brown)
- Height: `52px`, `padding: 0 24px`
- Brand `"⬡ Orders"`: 15px, 700, color `#fb923c`
- Nav links: 13px, 500, color `#fdba74`. Active: `background: rgba(251,146,60,0.2)`, color `#fb923c`. Hover: `background: rgba(251,146,60,0.15)`.
- Email: 13px, `#fdba74`
- Log out button: `background: rgba(251,146,60,0.15)`, `border: 1px solid rgba(251,146,60,0.3)`, color `#fb923c`, 12px, 500
- **Customer nav links:** My Orders (`/orders`), New Order (`/orders/new`)
- **Admin nav links:** All Orders (`/admin/orders`), Users (`/admin/users`)
- Mobile (≤640px): email hidden, links tighten to `padding: 6px 8px`

---

## Status Badges

Pill shape: `border-radius: 20px`, `padding: 3px 9px`, 11px, 700, uppercase, `letter-spacing: 0.05em`.

| Status     | Background | Text    |
|------------|------------|---------|
| PENDING    | `#fef3c7`  | `#92400e` |
| PROCESSING | `#fed7aa`  | `#9a3412` |
| SHIPPED    | `#ede9fe`  | `#5b21b6` |
| DELIVERED  | `#dcfce7`  | `#15803d` |
| CANCELLED  | `#fee2e2`  | `#991b1b` |

---

## Role Badges

Pill shape: `border-radius: 20px`, `padding: 2px 7px`, 10px, 700, uppercase, `letter-spacing: 0.06em`.

| Role     | Background | Text    |
|----------|------------|---------|
| customer | `#fed7aa`  | `#9a3412` |
| admin    | `#fde68a`  | `#78350f` |

---

## Design Tokens

### Colors
```
Background page:    #fff7ed
Background card:    #ffffff
Background muted:   #ffedd5
Border default:     #fed7aa
Border strong:      #fb923c
Primary orange:     #f97316
Primary dark:       #c2410c
Primary light:      #ffedd5
Nav background:     #431407
Text primary:       #431407
Text muted:         #9a3412
Text light:         #78350f
Red (danger):       #dc2626
Red light:          #fee2e2
Green (success):    #16a34a
Green light:        #dcfce7
```

### Typography
```
Font stack:   -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif
Base size:    14px
Line height:  1.5

Page title:       22px / 700
Auth title:       20px / 700
Section label:    11px / 700 / uppercase / letter-spacing 0.04em
Order ID:         13px / 700
Body:             14px / 400
Small/meta:       13px / 400
Extra small:      12px / 400
Badge:            11px / 700 / uppercase / letter-spacing 0.05em
```

### Spacing & Radii
```
Page max-width:   860px
Page padding:     32px 24px  (mobile: 20px 14px)
Card padding:     20px
Card radius:      8px
Auth card radius: 12px
Button radius:    7px
Input radius:     6px
Badge radius:     20px
```

### Shadows
```
Default:  0 1px 3px rgba(120,53,15,0.12), 0 1px 2px rgba(120,53,15,0.08)
Medium:   0 4px 12px rgba(120,53,15,0.15)
Focus:    0 0 0 3px rgba(249,115,22,0.12)
Highlight:0 0 0 2px rgba(249,115,22,0.2)
```

---

## Form Elements

**Labels:** 12px, 700, uppercase, `letter-spacing: 0.04em`, color `#78350f`  
**Inputs / Selects:** `border: 1px solid #fed7aa`, `border-radius: 6px`, `padding: 8px 10px`, 14px, white background  
**Focus state:** `border-color: #f97316`, `box-shadow: 0 0 0 3px rgba(249,115,22,0.12)`  
**Error state:** `border-color: #dc2626` + inline error text 12px `#dc2626` below input

---

## Buttons

| Variant  | Background | Text  | Hover bg   |
|----------|-----------|-------|------------|
| primary  | `#f97316` | white | `#c2410c`  |
| outline  | transparent | `#f97316` | `#ffedd5` |
| danger   | `#dc2626` | white | `#b91c1c`  |
| ghost    | transparent | `#9a3412` | `#ffedd5` |

All buttons: `border-radius: 7px`, 13px, 600 weight, `padding: 8px 18px`.  
Small variant: `padding: 5px 12px`, 12px.  
Disabled: `opacity: 0.5`, `cursor: not-allowed`.

---

## Toast Notifications

- Position: fixed, bottom-right, `bottom: 24px`, `right: 24px`
- Stack vertically with `gap: 8px`; newest at bottom
- Shape: `border-radius: 8px`, `padding: 12px 16px`, 13px, 500 weight
- Auto-dismiss after 3.2s
- Animation: fade + slide up 8px, 0.2s ease

| Type    | Background |
|---------|------------|
| default | `#431407` (nav color) |
| success | `#16a34a` |
| error   | `#dc2626` |

Prefix icon: `✓` success, `✕` error, `ℹ` default.  
Mobile: stretches full width (`left: 12px`, `right: 12px`).

---

## Loading & Empty States

**Skeleton cards:** animated shimmer, `height: 110px`, `border-radius: 8px`.  
Gradient: `#fed7aa → #ffedd5 → #fed7aa`, `background-size: 200%`, animation 1.4s infinite.  
Show 3 skeletons while fetching; never block the whole page with a spinner.

**Empty state (orders):**
- Icon: `📦` at 40px
- Heading: 16px, 600, `#78350f`
- Body: 13px
- If filter is ALL: show `"+ New Order"` CTA button
- If filter is active: show `"Try a different filter."`

---

## Error Handling

| Situation              | Response                                              |
|------------------------|-------------------------------------------------------|
| 401 on any request     | Auto-redirect to `/login` (Axios interceptor)         |
| 403                    | Toast: `"You don't have permission to do that"`       |
| 400 on cancel          | Toast: `"Only pending orders can be cancelled."` + revert optimistic update |
| 422 on form submit     | Highlight fields with inline error text               |
| Network error          | Toast: `"Something went wrong. Try again."`           |
| Empty order list       | Empty state (not an error)                            |

Cancel order uses **optimistic UI** — update to CANCELLED immediately in the list, revert if `DELETE /orders/{id}/cancel` returns an error.

---

## Routing & Auth Guards

```
/login            → LoginPage        (unauthenticated only)
/register         → RegisterPage     (unauthenticated only)
/orders           → CustomerOrdersPage  (customer only)
/orders/new       → NewOrderPage        (customer only)
/admin/orders     → AdminOrdersPage     (admin only)
/admin/users      → AdminUsersPage      (admin only)
*                 → redirect to /login
```

After login: admin → `/admin/orders`, customer → `/orders`.  
JWT payload contains `{ id, email, role }`. Decode with `atob(token.split('.')[1])`.

---

## Polling

Orders lists poll `GET /orders` every **10 seconds**:
```js
useEffect(() => {
  fetchOrders()
  const id = setInterval(fetchOrders, 10_000)
  return () => clearInterval(id)
}, [statusFilter])
```

---

## Files in This Package

| File | Description |
|------|-------------|
| `prototype.html` | Full hi-fi interactive prototype (self-contained, mock data) |
| `README.md` | This document |

The original design handoff spec (`claude_design_handoff.md`) contains the full API spec, component tree, and Vite config — refer to it alongside this document.
