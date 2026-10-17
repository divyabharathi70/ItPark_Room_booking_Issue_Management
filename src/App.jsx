import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import GuestRoute from "./components/GuestRoute";
import AppLayout from "./components/layout/AppLayout";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import PublicBooking from "./pages/PublicBooking";
import GuestBooking from "./pages/GuestBooking";
import UserBooking from "./pages/UserBooking";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/common/ComingSoon";
import PublicRooms from "./pages/public/Rooms";
import PublicRoomDetails from "./pages/public/RoomDetails";
import PublicCampusDetails from "./pages/public/CampusDetails";
import PublicAmenities from "./pages/public/Amenities";
import PublicHowItWorks from "./pages/public/HowItWorks";
import PublicAbout from "./pages/public/About";
import PublicFaq from "./pages/public/Faq";
import PublicContact from "./pages/public/Contact";

import AdminDashboard from "./pages/admin/Dashboard";
import AdminBookings from "./pages/admin/Bookings";
import AdminRooms from "./pages/admin/Rooms";
import AdminExtendRequests from "./pages/admin/ExtendRequests";
import AdminIssues from "./pages/admin/Issues";
import AdminIssueDetails from "./pages/admin/IssueDetails";
import AdminMaintenance from "./pages/admin/Maintenance";
import AdminWorkers from "./pages/admin/Workers";
import AdminEmployees from "./pages/admin/Employees";
import AdminClients from "./pages/admin/Clients";
import AdminCategories from "./pages/admin/Categories";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminSettings from "./pages/admin/Settings";
import ClientDashboard from "./pages/client/Dashboard";
import EmployeeDashboard from "./pages/employee/Dashboard";
import WorkerDashboard from "./pages/worker/Dashboard";
import BookingNew from "./pages/client/BookingNew";
import MyBookings from "./pages/client/MyBookings";
import RaiseIssue from "./pages/employee/RaiseIssue";
import EmployeeMyIssues from "./pages/employee/MyIssues";
import EmployeeIssueDetails from "./pages/employee/IssueDetails";
import ClientRaiseIssue from "./pages/client/RaiseIssue";
import ClientMyIssues from "./pages/client/MyIssues";
import ClientIssueDetails from "./pages/client/IssueDetails";
import WorkerIssues from "./pages/worker/Issues";
import WorkerTasks from "./pages/worker/Tasks";
import WorkerIssueDetails from "./pages/worker/IssueDetails";
import Notifications from "./pages/shared/Notifications";
import Profile from "./pages/common/Profile";

import { ROLES, PENDING_USER_ROLE } from "./data/mockUsers";
import { NAV_ITEMS } from "./data/navigation";

// The Dashboard route for each role gets its own component; every other
// sidebar link is generated from NAV_ITEMS so a new menu entry only ever
// needs to be added in one place (data/navigation.js) to get a working,
// laid-out route.
const DASHBOARD_COMPONENTS = {
  [ROLES.ADMIN]: AdminDashboard,
  [ROLES.CLIENT]: ClientDashboard,
  [ROLES.EMPLOYEE]: EmployeeDashboard,
  [ROLES.WORKER]: WorkerDashboard,
};

// Real feature pages that replace the generic ComingSoon placeholder for
// specific nav paths, keyed by role. Only add an entry here once the
// screen behind that sidebar link has actually been built.
const ROUTE_OVERRIDES = {
  [ROLES.ADMIN]: {
    "/admin/bookings": AdminBookings,
    "/admin/rooms": AdminRooms,
    "/admin/extend-requests": AdminExtendRequests,
    "/admin/issues": AdminIssues,
    "/admin/maintenance": AdminMaintenance,
    "/admin/workers": AdminWorkers,
    "/admin/employees": AdminEmployees,
    "/admin/clients": AdminClients,
    "/admin/categories": AdminCategories,
    "/admin/analytics": AdminAnalytics,
    "/admin/notifications": Notifications,
    "/admin/settings": AdminSettings,
  },
  [ROLES.CLIENT]: {
    "/client/book-room": BookingNew,
    "/client/bookings": MyBookings,
    "/client/issues": ClientMyIssues,
    "/client/notifications": Notifications,
    "/client/profile": Profile,
  },
  [ROLES.EMPLOYEE]: {
    "/employee/raise-issue": RaiseIssue,
    "/employee/issues": EmployeeMyIssues,
    "/employee/notifications": Notifications,
    "/employee/profile": Profile,
  },
  [ROLES.WORKER]: {
    "/worker/issues": WorkerIssues,
    "/worker/tasks": WorkerTasks,
    "/worker/notifications": Notifications,
    "/worker/profile": Profile,
  },
};

// Routes that aren't in the sidebar nav but still need to exist (e.g. a
// "new booking" screen reached via a button rather than a menu link).
const EXTRA_ROUTES = {
  [ROLES.ADMIN]: [{ path: "/admin/issues/:id", Component: AdminIssueDetails }],
  [ROLES.CLIENT]: [
    { path: "/client/bookings/new", Component: BookingNew },
    { path: "/client/issues/new", Component: ClientRaiseIssue },
    { path: "/client/issues/:id", Component: ClientIssueDetails },
  ],
  [ROLES.EMPLOYEE]: [
    { path: "/employee/issues/new", Component: RaiseIssue },
    { path: "/employee/issues/:id", Component: EmployeeIssueDetails },
  ],
  [ROLES.WORKER]: [{ path: "/worker/issues/:id", Component: WorkerIssueDetails }],
};

function roleRoutes(role) {
  const DashboardComponent = DASHBOARD_COMPONENTS[role];
  const overrides = ROUTE_OVERRIDES[role] || {};
  const extras = EXTRA_ROUTES[role] || [];

  return (
    <Route key={role} element={<ProtectedRoute allowedRoles={[role]} />}>
      <Route element={<AppLayout />}>
        {NAV_ITEMS[role].map((item) => {
          if (item.label === "Dashboard") {
            return <Route key={item.path} path={item.path} element={<DashboardComponent />} />;
          }
          const OverrideComponent = overrides[item.path];
          if (OverrideComponent) {
            return <Route key={item.path} path={item.path} element={<OverrideComponent />} />;
          }
          return (
            <Route
              key={item.path}
              path={item.path}
              element={
                <ComingSoon
                  title={item.label}
                  description={item.description}
                  icon={item.icon}
                />
              }
            />
          );
        })}
        {extras.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component />} />
        ))}
      </Route>
    </Route>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public entry point — visible to signed-out visitors and signed-in
            users alike. No dashboard/auth gating here; only the protected
            role zones below require a session. */}
        <Route path="/" element={<PublicBooking />} />

        {/* Public marketing / browsing routes — same "visible regardless of
            auth state" rule as "/". PublicLayout itself adapts its nav for
            a signed-in Client vs. a signed-out visitor. */}
        <Route path="/rooms" element={<PublicRooms />} />
        <Route path="/rooms/:roomId" element={<PublicRoomDetails />} />
        <Route path="/campus/:facilityId" element={<PublicCampusDetails />} />
        <Route path="/amenities" element={<PublicAmenities />} />
        <Route path="/how-it-works" element={<PublicHowItWorks />} />
        <Route path="/about" element={<PublicAbout />} />
        <Route path="/faq" element={<PublicFaq />} />
        <Route path="/contact" element={<PublicContact />} />

        {/* Public guest booking request flow — no account required. Room
            is chosen on "/" first; this route handles visitor details,
            scheduling, amenities and submitting the (pending) request. */}
        <Route path="/book/:roomId" element={<GuestBooking />} />

        {/* Booking wizard for a signed-up user who is NOT an approved client
            yet. Signed in (user) or already approved (client) only; it lives
            on the public layout, outside the protected /client dashboard zone. */}
        <Route element={<ProtectedRoute allowedRoles={[PENDING_USER_ROLE, ROLES.CLIENT]} />}>
          <Route path="/book-room" element={<UserBooking />} />
        </Route>

        {/* Guest-only */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>

        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Role-protected zones, laid out inside the common AppLayout shell */}
        {Object.values(ROLES).map((role) => roleRoutes(role))}

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
