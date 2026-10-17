# IT Park — Room Booking & Facility Management System (Frontend)

A frontend-only React app for a 4-role IT Park facility system: **Admin**,
**Client**, **Employee**, and **Worker**. There is no backend — authentication
is mocked against an in-memory user list, and the session is persisted to
`localStorage` so a page refresh doesn't sign you out.

## Stack
React.js · HTML5 / JSX · JavaScript · Tailwind CSS · React Router v7 · React Hooks · localStorage

## Getting started
```bash
npm install
npm run dev       # start dev server -> http://localhost:5173
npm run build     # production build -> dist/
npm run preview   # preview the production build
```

## Demo accounts
| Role     | Email                 | Password |
|----------|------------------------|----------|
| Admin    | admin@park.com         | 123456   |
| Client   | client@company.com     | 123456   |
| Employee | employee@company.com   | 123456   |
| Worker   | worker@park.com        | 123456   |

Click **DEMO CREDENTIALS** on the login page to expand quick-fill cards for
all four accounts instead of typing them by hand.

## What's implemented so far
- **Project structure** — `src/pages`, `src/components`, `src/context`, `src/data`, `src/utils`
- **AuthContext** (`src/context/AuthContext.jsx`) — `login()`, `logout()`, current `user`,
  session restored from `localStorage` on load, exposed via the `useAuth()` hook
- **ProtectedRoute** — redirects to `/login` if signed out, and to `/unauthorized` if the
  signed-in user's role isn't in that route's `allowedRoles`
- **GuestRoute** — keeps an already-signed-in user off `/login` and sends them straight to
  their own dashboard
- **Login page** — required-field + email-format + min-length password validation with
  inline errors, a show/hide password toggle, an animated "AUTHENTICATING…" submit state,
  a dismissible error banner for bad credentials, and redirect-back-to-the-page-you-wanted
  support (`location.state.from`)
- **`/unauthorized`** page shown on role mismatches, with a link back to the user's own zone
- **`/404`** catch-all page
- **Logout** — available from every dashboard header, clears the stored session
- One **placeholder dashboard per role** (`/admin/dashboard`, `/client/dashboard`,
  `/employee/dashboard`, `/worker/dashboard`) that proves routing, guards, session
  persistence, and logout all work end to end

Real dashboards (room booking calendar, facility requests, task queues, admin controls,
reporting, etc.) are the next milestone — this phase is intentionally just auth + routing.

## Routing map
- `/` → redirects to `/login`
- `/login` → guest-only (signed-in users are bounced to their dashboard)
- `/unauthorized` → shown when a signed-in role hits a route it can't access
- `/admin/dashboard` → Admin only
- `/client/dashboard` → Client only
- `/employee/dashboard` → Employee only
- `/worker/dashboard` → Worker only
- `*` → 404

## Notes on the mock data layer
`src/data/mockUsers.js` holds the 4 demo accounts and role metadata (labels, home routes,
and the "zone" descriptions used in the login page's site-plan illustration). Swapping this
for a real backend later just means replacing the `login()` implementation inside
`AuthContext.jsx` — every consumer of `useAuth()` stays the same.
