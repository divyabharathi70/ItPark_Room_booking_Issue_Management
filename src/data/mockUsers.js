// Mock user directory for the IT Park Room Booking & Facility Management System.
// This is a frontend-only demo — there is no backend, so credentials are
// checked against this in-memory array instead of a real database.

export const ROLES = {
  ADMIN: "admin",
  CLIENT: "client",
  EMPLOYEE: "employee",
  WORKER: "worker",
};

// A signed-up visitor who has NOT had a booking request approved by Admin
// yet. This is deliberately kept OUT of ROLES: App.jsx builds one protected
// zone (routes + sidebar) for every entry in ROLES, and a registered user
// has no zone of their own - they browse the public site and can request a
// booking, but they cannot open the Client Dashboard until Admin approves.
export const PENDING_USER_ROLE = "user";

export const ROLE_HOME = {
  [ROLES.ADMIN]: "/admin/dashboard",
  [ROLES.CLIENT]: "/client/dashboard",
  [ROLES.EMPLOYEE]: "/employee/dashboard",
  [ROLES.WORKER]: "/worker/dashboard",
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: "Administrator",
  [ROLES.CLIENT]: "Client",
  [ROLES.EMPLOYEE]: "Employee",
  [ROLES.WORKER]: "Facility Worker",
  [PENDING_USER_ROLE]: "Registered User",
};

export const MOCK_USERS = [
  {
    id: "u-001",
    name: "Aarav Mehta",
    email: "admin@park.com",
    password: "123456",
    role: ROLES.ADMIN,
  },
  {
    id: "u-002",
    name: "Priya Nair",
    email: "client@company.com",
    password: "123456",
    role: ROLES.CLIENT,
    organization: "ABC Technologies",
  },
  {
    id: "u-003",
    name: "Rohan Iyer",
    email: "employee@company.com",
    password: "123456",
    role: ROLES.EMPLOYEE,
    organization: "IT Park Internal Staff",
  },
  {
    id: "u-004",
    name: "Suresh Kumar",
    email: "worker@park.com",
    password: "123456",
    role: ROLES.WORKER,
  },
  {
    id: "w-002",
    name: "Ravi Shankar",
    email: "ravi@park.com",
    password: "123456",
    role: ROLES.WORKER,
  },
  {
    id: "w-003",
    name: "Arjun Verma",
    email: "arjun@park.com",
    password: "123456",
    role: ROLES.WORKER,
  },
  {
    id: "w-004",
    name: "Kavya Reddy",
    email: "kavya@park.com",
    password: "123456",
    role: ROLES.WORKER,
  },
  {
    id: "w-005",
    name: "Lakshmi Menon",
    email: "lakshmi@park.com",
    password: "123456",
    role: ROLES.WORKER,
  },
  {
    id: "w-006",
    name: "Manoj Pillai",
    email: "manoj@park.com",
    password: "123456",
    role: ROLES.WORKER,
  },
  {
    id: "w-007",
    name: "Deepa Krishnan",
    email: "deepa@park.com",
    password: "123456",
    role: ROLES.WORKER,
  },
  {
    id: "w-008",
    name: "Vikram Nair",
    email: "vikram@park.com",
    password: "123456",
    role: ROLES.WORKER,
  },
];
