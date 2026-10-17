// Mock facility-worker directory used by Admin Issue Management to power
// the Assign/Reassign Worker dropdown. This is separate from MOCK_USERS
// (which only needs one loginable worker account) so the admin has a
// realistic roster to pick from across every department.
//
// Suresh Kumar (u-004) is kept as the first Facilities worker so he stays
// in sync with the real "worker@park.com" login used to demo the worker
// side of the flow end-to-end.

export const DEPARTMENTS = [
  "Facilities",
  "IT / Technical",
  "Network",
  "Housekeeping",
  "Plumbing",
  "Safety",
];

export const MOCK_WORKERS = [
  { id: "u-004", name: "Suresh Kumar", department: "Facilities" },
  { id: "w-002", name: "Ravi Shankar", department: "Facilities" },
  { id: "w-003", name: "Arjun Verma", department: "IT / Technical" },
  { id: "w-004", name: "Kavya Reddy", department: "Network" },
  { id: "w-005", name: "Lakshmi Menon", department: "Housekeeping" },
  { id: "w-006", name: "Manoj Pillai", department: "Plumbing" },
  { id: "w-007", name: "Deepa Krishnan", department: "Safety" },
  { id: "w-008", name: "Vikram Nair", department: "IT / Technical" },
];

export function getWorkerById(id) {
  return MOCK_WORKERS.find((w) => w.id === id) || null;
}

export function getWorkersByDepartment(department) {
  return MOCK_WORKERS.filter((w) => w.department === department);
}
