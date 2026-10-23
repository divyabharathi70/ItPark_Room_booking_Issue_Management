import { ROLES } from "./mockUsers";

// Sidebar menu definitions per role. `path` values are absolute routes
// registered in App.jsx; `icon` keys map to components/icons/Icon.jsx.
// `description` is used as the subtitle on each route's placeholder page
// until the real feature is built.
// "Logout" is intentionally not listed here — it's rendered as an action
// button at the bottom of the sidebar, not a route link.

export const NAV_ITEMS = {
  [ROLES.ADMIN]: [
    { label: "Dashboard", path: "/admin/dashboard", icon: "dashboard" },
    { label: "Bookings", path: "/admin/bookings", icon: "calendar", description: "Review and manage every room booking across the park." },
    { label: "Extend Requests", path: "/admin/extend-requests", icon: "clock", description: "Review and respond to client requests to extend an existing booking." },
    { label: "Rooms", path: "/admin/rooms", icon: "door", description: "Add, edit, and configure bookable rooms and facilities." },
    { label: "Issues", path: "/admin/issues", icon: "alert", description: "Track and resolve issues reported by clients and employees." },
    { label: "Workers", path: "/admin/workers", icon: "wrench", description: "Manage facility workers and their assigned tasks." },
    { label: "Employees", path: "/admin/employees", icon: "briefcase", description: "Manage employee accounts and access." },
    { label: "Clients", path: "/admin/clients", icon: "users", description: "Manage client companies and their accounts." },
    { label: "Maintenance", path: "/admin/maintenance", icon: "tool", description: "Schedule and monitor facility maintenance work." },
    { label: "Categories", path: "/admin/categories", icon: "tag", description: "Organize rooms and issues into categories." },
    { label: "Analytics", path: "/admin/analytics", icon: "chart", description: "Usage trends, occupancy, and system-wide reporting." },
    { label: "Notifications", path: "/admin/notifications", icon: "bell", description: "System-wide alerts and updates." },
    { label: "Settings", path: "/admin/settings", icon: "settings", description: "Configure system preferences and defaults." },
  ],
  [ROLES.CLIENT]: [
    { label: "Dashboard", path: "/client/dashboard", icon: "dashboard" },
    { label: "Book a Room", path: "/client/book-room", icon: "plusSquare", description: "Find and reserve an available room." },
    { label: "My Bookings", path: "/client/bookings", icon: "clipboardList", description: "View and manage your upcoming and past bookings." },
    { label: "Employees", path: "/client/employees", icon: "briefcase", description: "Manage employees for your company." },
    { label: "My Issues", path: "/client/issues", icon: "alert", description: "Report a facility issue or track ones you've raised." },
    { label: "Notifications", path: "/client/notifications", icon: "bell", description: "Updates on your bookings and issues." },
    { label: "Profile", path: "/client/profile", icon: "user", description: "Manage your account details." },
  ],
  [ROLES.EMPLOYEE]: [
    { label: "Dashboard", path: "/employee/dashboard", icon: "dashboard" },
    { label: "Raise Issue", path: "/employee/raise-issue", icon: "megaphone", description: "Report a new facility issue." },
    { label: "My Issues", path: "/employee/issues", icon: "alert", description: "Track the status of issues you've raised." },
    { label: "Notifications", path: "/employee/notifications", icon: "bell", description: "Updates on your bookings and issues." },
    { label: "Profile", path: "/employee/profile", icon: "user", description: "Manage your account details." },
  ],
  [ROLES.WORKER]: [
    { label: "Dashboard", path: "/worker/dashboard", icon: "dashboard" },
    { label: "My Issues", path: "/worker/issues", icon: "alert", description: "Issues assigned to you for resolution." },
    { label: "Assigned Tasks", path: "/worker/tasks", icon: "listChecks", description: "Your maintenance and task queue." },
    { label: "Notifications", path: "/worker/notifications", icon: "bell", description: "Updates on your assigned tasks and issues." },
    { label: "Profile", path: "/worker/profile", icon: "user", description: "Manage your account details." },
  ],
};
