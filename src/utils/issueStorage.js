// Thin localStorage-backed persistence for the facility issue-reporting
// flow. Mirrors the pattern already used in utils/bookingStorage.js —
// synchronous, mock-only, no server behind it.

import { getBookingsForClient, BOOKING_STATUS, PAYMENT_STATUS } from "./bookingStorage";
import { MOCK_USERS, ROLES } from "../data/mockUsers";
import { getWorkerById, getWorkersByDepartment } from "../data/mockWorkers";
import { createNotification, NOTIFICATION_TYPES } from "./notificationStorage";
import { getRoomBlock, unblockRoom, blockRoom } from "./roomStatusStorage";
import { publishSharedRecords } from "./sharedDataSync";

const ISSUES_KEY = "itpark_issues";
export const ISSUES_EVENT = "itpark:issues-changed";

export const ISSUE_STATUS = {
  OPEN: "OPEN",
  ASSIGNED: "ASSIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
  REOPENED: "REOPENED",
};

// Metadata for each possible timeline stage — used to render the visual
// issue timeline consistently wherever an issue is shown in detail.
// REASSIGNED and ROOM_BLOCKED are "event" entries rather than real values
// of issue.status — they're pushed onto statusHistory via updateIssue's
// timelineEvent option so admin actions like reassigning a worker or
// blocking a room show up in the timeline without pretending the issue's
// actual lifecycle status changed.
export const TIMELINE_STAGE_META = {
  [ISSUE_STATUS.OPEN]: { label: "Issue Created", icon: "megaphone" },
  [ISSUE_STATUS.ASSIGNED]: { label: "Assigned", icon: "user" },
  [ISSUE_STATUS.IN_PROGRESS]: { label: "In Progress", icon: "clock" },
  [ISSUE_STATUS.RESOLVED]: { label: "Resolved", icon: "checkCircle" },
  [ISSUE_STATUS.CLOSED]: { label: "Closed", icon: "shieldCheck" },
  [ISSUE_STATUS.REOPENED]: { label: "Reopened", icon: "alert" },
  REASSIGNED: { label: "Reassigned", icon: "usersSmall" },
  ROOM_BLOCKED: { label: "Room Blocked", icon: "ban" },
};

// Canonical forward order of the "happy path" lifecycle. REOPENED is
// intentionally excluded — it's a branch off this path, not a step on it.
const LIFECYCLE_ORDER = [
  ISSUE_STATUS.OPEN,
  ISSUE_STATUS.ASSIGNED,
  ISSUE_STATUS.IN_PROGRESS,
  ISSUE_STATUS.RESOLVED,
  ISSUE_STATUS.CLOSED,
];

// The single definition of "active workload" for a worker, reused by both
// automatic assignment's least-loaded selection below and the admin
// Workers directory's per-worker workload count. OPEN issues aren't
// counted because an issue can't have an assignedWorkerId while OPEN —
// assignment always moves it straight to ASSIGNED — and REOPENED is a
// branch state waiting to be (re)assigned, not work currently in someone's
// queue, so it's excluded the same way the Workers page already treats it.
export const ACTIVE_ISSUE_STATUSES = [ISSUE_STATUS.ASSIGNED, ISSUE_STATUS.IN_PROGRESS];
export const RESOLVED_ISSUE_STATUSES = [ISSUE_STATUS.RESOLVED, ISSUE_STATUS.CLOSED];

export const PRIORITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
};

export const PRIORITY_ORDER = [PRIORITY.LOW, PRIORITY.MEDIUM, PRIORITY.HIGH, PRIORITY.CRITICAL];

// Issue categories, grouped for the Raise Issue form. Each item carries a
// defaultPriority used to auto-suggest a priority once a category is picked.
export const ISSUE_CATEGORIES = {
  FACILITIES: {
    label: "Facilities",
    icon: "door",
    items: [
      { value: "AC", label: "AC", defaultPriority: PRIORITY.HIGH },
      { value: "Furniture", label: "Furniture", defaultPriority: PRIORITY.LOW },
      { value: "Lighting", label: "Lighting", defaultPriority: PRIORITY.MEDIUM },
      { value: "Water", label: "Water", defaultPriority: PRIORITY.HIGH },
      { value: "Plumbing", label: "Plumbing", defaultPriority: PRIORITY.HIGH },
      { value: "Electricity", label: "Electricity", defaultPriority: PRIORITY.CRITICAL },
    ],
  },
  TECHNICAL: {
    label: "Technical",
    icon: "projector",
    items: [
      { value: "WiFi", label: "WiFi", defaultPriority: PRIORITY.MEDIUM },
      { value: "Projector", label: "Projector", defaultPriority: PRIORITY.MEDIUM },
      { value: "Computer", label: "Computer", defaultPriority: PRIORITY.MEDIUM },
      { value: "Screen", label: "Screen", defaultPriority: PRIORITY.MEDIUM },
      { value: "Microphone", label: "Microphone", defaultPriority: PRIORITY.LOW },
      { value: "Speaker", label: "Speaker", defaultPriority: PRIORITY.LOW },
      { value: "Network", label: "Network", defaultPriority: PRIORITY.HIGH },
    ],
  },
  CLEANLINESS: {
    label: "Cleanliness",
    icon: "clipboardList",
    items: [
      { value: "Room Cleaning", label: "Room Cleaning", defaultPriority: PRIORITY.LOW },
      { value: "Washroom", label: "Washroom", defaultPriority: PRIORITY.MEDIUM },
      { value: "Waste", label: "Waste", defaultPriority: PRIORITY.LOW },
      { value: "Hygiene", label: "Hygiene", defaultPriority: PRIORITY.MEDIUM },
    ],
  },
  SAFETY: {
    label: "Safety",
    icon: "shieldCheck",
    items: [
      { value: "Electrical", label: "Electrical", defaultPriority: PRIORITY.CRITICAL },
      { value: "Fire Safety", label: "Fire Safety", defaultPriority: PRIORITY.CRITICAL },
      { value: "Emergency", label: "Emergency", defaultPriority: PRIORITY.CRITICAL },
      { value: "Security", label: "Security", defaultPriority: PRIORITY.HIGH },
    ],
  },
};

// Flat lookup: category value -> { value, label, defaultPriority, group, groupLabel }
export const CATEGORY_LOOKUP = Object.entries(ISSUE_CATEGORIES).reduce((acc, [groupKey, group]) => {
  group.items.forEach((item) => {
    acc[item.value] = { ...item, group: groupKey, groupLabel: group.label };
  });
  return acc;
}, {});

export function suggestPriority(categoryValue) {
  return CATEGORY_LOOKUP[categoryValue]?.defaultPriority || PRIORITY.MEDIUM;
}

// ---------------------------------------------------------------------
// Admin: category -> department routing
// ---------------------------------------------------------------------

export const DEPARTMENTS = [
  "Facilities",
  "IT / Technical",
  "Network",
  "Housekeeping",
  "Plumbing",
  "Safety",
];

// Explicit per-category overrides (matches the routing examples called out
// for the admin Assign Worker flow — e.g. Water/Plumbing go to Plumbing
// even though they live in the "Facilities" category group, and WiFi goes
// to Network rather than general IT/Technical).
const CATEGORY_DEPARTMENT_OVERRIDES = {
  Water: "Plumbing",
  Plumbing: "Plumbing",
  WiFi: "Network",
  Network: "Network",
};

// Fallback routing by category group, for any category without a more
// specific override above.
const GROUP_DEPARTMENT_MAP = {
  FACILITIES: "Facilities",
  TECHNICAL: "IT / Technical",
  CLEANLINESS: "Housekeeping",
  SAFETY: "Safety",
};

/** Suggests the department an issue should be routed to, based on its
 * category. Admin sees this as a default in the Assign Worker modal but
 * can still pick any department/worker manually. */
export function suggestDepartment(categoryValue) {
  if (CATEGORY_DEPARTMENT_OVERRIDES[categoryValue]) {
    return CATEGORY_DEPARTMENT_OVERRIDES[categoryValue];
  }
  const group = CATEGORY_LOOKUP[categoryValue]?.group;
  return GROUP_DEPARTMENT_MAP[group] || "Facilities";
}

function readAll() {
  try {
    const raw = localStorage.getItem(ISSUES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Corrupted issue data, clearing it.", err);
    localStorage.removeItem(ISSUES_KEY);
    return [];
  }
}

function writeAll(list) {
  const previous = readAll();
  localStorage.setItem(ISSUES_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(ISSUES_EVENT));
  const previousById = new Map(previous.map((issue) => [issue.id, JSON.stringify(issue)]));
  const changed = list.filter((issue) => previousById.get(issue.id) !== JSON.stringify(issue));
  void publishSharedRecords("issues", changed);
}

// ---------------------------------------------------------------------
// Notification helpers — every notification-triggering event listed in
// the spec is fired from exactly one place below, right where the
// underlying issue/room record is actually written, so every existing
// page that calls into this file gets notifications for free.
// ---------------------------------------------------------------------

function toTitleCase(str) {
  return String(str)
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/** Notifies the reporter (and, for resolutions triggered by a worker,
 * the admin) whenever an issue's real lifecycle status changes. Called
 * once, generically, from updateIssue() — except for a transition into
 * ASSIGNED, which assignWorkerToIssue() reports itself with a richer,
 * worker-specific message so the reporter/admin don't get a duplicate,
 * generic "status changed" notification on top of it. */
function notifyIssueStatusChange(issue) {
  const reporterRecipient = {
    recipientId: issue.employeeId,
    recipientRole: issue.reporterRole || "employee",
  };

  if (issue.status === ISSUE_STATUS.RESOLVED) {
    createNotification({
      ...reporterRecipient,
      type: NOTIFICATION_TYPES.ISSUE_RESOLVED,
      message: `Issue #${issue.id} has been resolved.`,
      relatedId: issue.id,
      relatedType: "issue",
    });
    // Admin already knows when admin itself performed the resolution;
    // only broadcast when a worker resolved it out in the field.
    const resolvedByAdmin = typeof issue.resolvedBy === "string" && issue.resolvedBy.includes("(Admin)");
    if (!resolvedByAdmin) {
      createNotification({
        recipientRole: "admin",
        type: NOTIFICATION_TYPES.ISSUE_RESOLVED,
        message: `Issue #${issue.id} has been resolved by ${issue.resolvedBy || "a worker"}.`,
        relatedId: issue.id,
        relatedType: "issue",
      });
    }
    return;
  }

  createNotification({
    ...reporterRecipient,
    type: NOTIFICATION_TYPES.ISSUE_STATUS_CHANGED,
    message: `Issue #${issue.id} is now ${toTitleCase(String(issue.status).replace(/_/g, " "))}.`,
    relatedId: issue.id,
    relatedType: "issue",
  });
}

/** If the room tied to this issue was blocked for maintenance because of
 * this exact issue, resolving the issue is what actually completes that
 * maintenance — so unblock the room and let admins know. Booking records
 * are never touched here, same as blockRoomForIssue(). */
function completeMaintenanceIfBlocked(issue) {
  const block = getRoomBlock(issue.roomId);
  if (block && block.relatedIssueId === issue.id) {
    unblockRoom(issue.roomId);
    createNotification({
      recipientRole: "admin",
      type: NOTIFICATION_TYPES.MAINTENANCE_COMPLETED,
      message: `Room ${issue.roomName} is available again (Issue #${issue.id} resolved).`,
      relatedId: issue.id,
      relatedType: "issue",
    });
  }
}

/** A CRITICAL issue automatically puts its room into maintenance — no
 * admin click required, per the "unresolved CRITICAL issue -> room
 * unavailable" rule. Never overwrites an existing active block (e.g. the
 * room may already be down for a different, still-open issue); once that
 * block clears, resolving/reopening logic below re-evaluates as needed. */
function startMaintenanceIfCritical(issue) {
  if (issue.priority !== PRIORITY.CRITICAL) return;
  if (getRoomBlock(issue.roomId)) return; // already unavailable for some reason
  blockRoom({
    roomId: issue.roomId,
    roomName: issue.roomName,
    reason: `Critical issue reported: ${issue.category}`,
    relatedIssueId: issue.id,
    blockedBy: "System (auto)",
  });
  createNotification({
    recipientRole: "admin",
    type: NOTIFICATION_TYPES.MAINTENANCE_STARTED,
    message: `Room ${issue.roomName} is now under maintenance due to a critical issue (#${issue.id}).`,
    relatedId: issue.id,
    relatedType: "issue",
  });
}

/** Mirror of startMaintenanceIfCritical for the "priority downgraded away
 * from CRITICAL" case: if this exact issue is what's currently holding the
 * room in maintenance and it's no longer CRITICAL, lift the block. Only
 * acts on blocks this issue itself created/owns (relatedIssueId match) so
 * an admin's manual block is never silently undone by a priority edit. */
function liftMaintenanceIfDowngraded(issue) {
  if (issue.priority === PRIORITY.CRITICAL) return;
  const block = getRoomBlock(issue.roomId);
  if (block && block.relatedIssueId === issue.id) {
    unblockRoom(issue.roomId);
    createNotification({
      recipientRole: "admin",
      type: NOTIFICATION_TYPES.MAINTENANCE_COMPLETED,
      message: `Room ${issue.roomName} is available again (Issue #${issue.id} downgraded from Critical).`,
      relatedId: issue.id,
      relatedType: "issue",
    });
  }
}

/** Unresolved (not RESOLVED/CLOSED) issues for a room, worst priority
 * first — this is what the booking page checks before letting a client
 * book, independent of whether the room has also been formally blocked. */
const PRIORITY_WEIGHT = { [PRIORITY.CRITICAL]: 3, [PRIORITY.HIGH]: 2, [PRIORITY.MEDIUM]: 1, [PRIORITY.LOW]: 0 };

export function getUnresolvedIssuesForRoom(roomId) {
  return readAll()
    .filter(
      (i) =>
        i.roomId === roomId && i.status !== ISSUE_STATUS.RESOLVED && i.status !== ISSUE_STATUS.CLOSED
    )
    .sort((a, b) => (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0));
}

/** The single unresolved issue that should drive the booking warning for
 * this room — highest priority wins (CRITICAL > HIGH > MEDIUM > LOW). */
export function getWorstUnresolvedIssueForRoom(roomId) {
  return getUnresolvedIssuesForRoom(roomId)[0] || null;
}

/** Generates sequential mock issue IDs like ISS-1001, ISS-1002, ... */
export function generateIssueId() {
  const nums = readAll()
    .map((i) => parseInt(String(i.id).replace("ISS-", ""), 10))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 1000) + 1;
  return `ISS-${next}`;
}

export function getAllIssues() {
  return readAll();
}

// Issues are keyed by the id of whoever raised them (an employee or a
// client — both are just "the reporting user" from the storage layer's
// point of view). getIssuesForEmployee is kept as the original name for
// backward compatibility; getIssuesForUser/getIssuesForClient are aliases
// so client-facing code can read naturally without implying every raiser
// is an employee.
export function getIssuesForEmployee(userId) {
  return readAll()
    .filter((i) => i.employeeId === userId)
    .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
}

export const getIssuesForUser = getIssuesForEmployee;
export function getIssuesForClient(clientId) {
  return readAll()
    .filter((issue) => issue.clientId === clientId || issue.employeeId === clientId)
    .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
}

export function getIssueById(id) {
  return readAll().find((i) => i.id === id) || null;
}

export function createIssue(issue) {
  const list = readAll();
  const withHistory = {
    ...issue,
    assignmentMethod: issue.assignmentMethod || null,
    statusHistory: issue.statusHistory || [{ status: issue.status, at: issue.createdDate, note: "" }],
  };
  list.push(withHistory);
  writeAll(list);

  createNotification({
    recipientRole: "admin",
    type: NOTIFICATION_TYPES.ISSUE_CREATED,
    message: `Issue #${withHistory.id} has been created.`,
    relatedId: withHistory.id,
    relatedType: "issue",
  });

  // Automatic Assignment: route the new issue straight to the
  // least-loaded eligible worker in the department its category maps to
  // (e.g. Water/Plumbing -> Plumbing), so the admin doesn't have to
  // manually assign every incoming issue. This calls the exact same
  // assignWorkerToIssue() the manual "Assign Worker" flow uses — just
  // with method: "AUTO" — so it's the one place that ever writes
  // assignedWorkerId, and manual (re)assignment afterward keeps working
  // exactly as before.
  const department = suggestDepartment(withHistory.category);
  const autoWorker = pickWorkerForDepartment(department);

  if (autoWorker) {
    assignWorkerToIssue(withHistory.id, { worker: autoWorker, department, method: "AUTO" });
  } else {
    // No worker exists in the routed department at all — fall back to the
    // original heads-up broadcast so anyone in that department at least
    // knows an issue came in, even though nobody could be auto-assigned.
    getWorkersByDepartment(department).forEach((worker) => {
      createNotification({
        recipientId: worker.id,
        recipientRole: "worker",
        type: NOTIFICATION_TYPES.ISSUE_CREATED,
        message: `New ${withHistory.category} issue reported in ${withHistory.roomName} — awaiting ${department} assignment.`,
        relatedId: withHistory.id,
      });
    });
  }

  if (withHistory.priority === PRIORITY.CRITICAL) {
    createNotification({
      recipientRole: "admin",
      type: NOTIFICATION_TYPES.ISSUE_CRITICAL,
      message: `Issue #${withHistory.id} is critical and requires immediate attention.`,
      relatedId: withHistory.id,
      relatedType: "issue",
    });
    startMaintenanceIfCritical(withHistory);
  }

  // Re-read so the returned record reflects the auto-assignment (and its
  // ASSIGNED status/timeline entry) written above, not the pre-assignment
  // snapshot originally pushed to the list.
  return getIssueById(withHistory.id);
}

/** Updates an issue in place. Whenever `patch.status` differs from the
 * issue's current status, a new entry is appended to statusHistory so the
 * visual timeline always reflects exactly what actually happened, in
 * order — nothing about the timeline is ever hard-coded per page.
 *
 * `patch.timelineEvent` (`{ status, note }`) additionally lets a caller
 * force one extra history entry even when the issue's real `status` field
 * isn't changing — used for admin events like reassigning a worker or
 * blocking a room, which are worth recording on the timeline without
 * altering the issue's actual lifecycle status. */
export function updateIssue(id, patch) {
  const list = readAll();
  const idx = list.findIndex((i) => i.id === id);
  if (idx === -1) return null;

  const prev = list[idx];
  const now = new Date().toISOString();
  const history = Array.isArray(prev.statusHistory)
    ? [...prev.statusHistory]
    : [{ status: prev.status, at: prev.createdDate, note: "" }];

  const statusChanged = !!(patch.status && patch.status !== prev.status);
  if (statusChanged) {
    history.push({ status: patch.status, at: now, note: patch.statusNote || "" });
  } else if (patch.timelineEvent?.status) {
    history.push({ status: patch.timelineEvent.status, at: now, note: patch.timelineEvent.note || "" });
  }

  const { statusNote: _statusNote, timelineEvent: _timelineEvent, ...rest } = patch;
  list[idx] = { ...prev, ...rest, statusHistory: history, lastUpdated: now };
  writeAll(list);

  const updated = list[idx];
  // A transition into ASSIGNED is reported by assignWorkerToIssue() itself
  // with a richer, worker-specific message — skip the generic notification
  // here so the reporter/admin don't get a duplicate.
  if (statusChanged && patch.status !== ISSUE_STATUS.ASSIGNED) {
    notifyIssueStatusChange(updated);
  }
  return updated;
}

/** Builds the ordered, timestamped list of timeline stages that actually
 * happened for this issue — only stages the issue has genuinely passed
 * through are included, so an OPEN issue shows just "Issue Created" while
 * a CLOSED one shows its full journey (and a REOPENED one shows the branch
 * back out of Resolved/Closed too). */
export function buildIssueTimeline(issue) {
  if (!issue) return [];
  const history =
    Array.isArray(issue.statusHistory) && issue.statusHistory.length
      ? issue.statusHistory
      : [{ status: issue.status, at: issue.createdDate, note: "" }];

  return history.map((entry, idx) => {
    const meta = TIMELINE_STAGE_META[entry.status] || { label: entry.status, icon: "clock" };
    return {
      status: entry.status,
      label: meta.label,
      icon: meta.icon,
      at: entry.at,
      note: entry.note || "",
      isCurrent: idx === history.length - 1,
    };
  });
}

export { LIFECYCLE_ORDER };

/** Only admin-confirmed, paid bookings can be used to raise an issue. */
export function getEligibleBookingsForIssue(employeeId) {
  return getBookingsForClient(employeeId).filter(
    (b) =>
      b.bookingStatus === BOOKING_STATUS.CONFIRMED &&
      b.paymentStatus === PAYMENT_STATUS.PAID
  );
}

// ---------------------------------------------------------------------
// Worker-facing helpers
// ---------------------------------------------------------------------

/** Issues currently assigned to a specific worker, newest first. A worker
 * must never see another worker's queue — every worker page filters
 * through this single function so that rule only has to be correct once. */
export function getIssuesForWorker(workerId) {
  return readAll()
    .filter((i) => i.assignedWorkerId === workerId)
    .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
}

// ---------------------------------------------------------------------
// Automatic Assignment
// ---------------------------------------------------------------------
// "Active" work, for workload purposes, uses the same ACTIVE_ISSUE_STATUSES
// definition as the admin Workers directory (see top of file) — an issue
// counts against a worker's load only while ASSIGNED or IN_PROGRESS, and
// stops counting the moment it's RESOLVED or CLOSED.

/** Number of active (ASSIGNED or IN_PROGRESS) issues currently assigned to
 * a worker — the "current workload" automatic assignment balances across a
 * department. */
export function getActiveWorkloadForWorker(workerId) {
  return readAll().filter(
    (i) => i.assignedWorkerId === workerId && ACTIVE_ISSUE_STATUSES.includes(i.status)
  ).length;
}

/** Picks the worker automatic assignment should use for `department`: the
 * eligible worker (i.e. a member of that department — never any other)
 * currently carrying the fewest active issues. Ties break on roster
 * order, i.e. the first eligible worker, which doubles as a simple, stable
 * rotation since whoever gets picked immediately gains a workload point.
 * Returns null when the department has no workers at all. */
export function pickWorkerForDepartment(department) {
  const workers = getWorkersByDepartment(department);
  if (workers.length === 0) return null;

  let best = null;
  let bestLoad = Infinity;
  for (const worker of workers) {
    const load = getActiveWorkloadForWorker(worker.id);
    if (load < bestLoad) {
      best = worker;
      bestLoad = load;
    }
  }
  return best;
}

/** On-demand automatic assignment for an issue that already exists (the
 * admin's "Auto Assign" button) — same department routing + least-active-
 * workload worker selection that createIssue() runs automatically for
 * brand-new issues. Returns { issue, worker, department } on success, or
 * null when the routed department currently has no workers to assign. */
export function autoAssignIssue(issueId) {
  const issue = getIssueById(issueId);
  if (!issue) return null;

  const department = suggestDepartment(issue.category);
  const worker = pickWorkerForDepartment(department);
  if (!worker) return null;

  const updated = assignWorkerToIssue(issueId, { worker, department, method: "AUTO" });
  return updated ? { issue: updated, worker, department } : null;
}

/** An issue is considered "overdue" once it's been open (not resolved or
 * closed) for more than 24 hours. This is a simple mock heuristic — there's
 * no SLA/due-date field in this dataset — used purely to power the
 * dashboard's "Overdue" stat and highlight ageing tickets in the queue. */
export const OVERDUE_THRESHOLD_HOURS = 24;

// ---------------------------------------------------------------------
// Admin-facing helpers
// ---------------------------------------------------------------------

/** All issues, newest first — the admin's global view across every
 * reporter, room, and worker. */
export function getIssuesForAdmin() {
  return readAll().sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
}

/** Assigns (or reassigns) a worker to an issue. Both flows share this one
 * function so there's exactly one place that writes assignedWorkerId/
 * assignedWorker/assignedDepartment — the same fields worker pages already
 * key off of — which is what makes the worker's queue update immediately
 * without any duplicate issue record ever being created. */
export function assignWorkerToIssue(issueId, { worker, department, adminName, method = "MANUAL" }) {
  const issue = getIssueById(issueId);
  if (!issue) return null;
  const isReassign = !!issue.assignedWorkerId && issue.assignedWorkerId !== worker.id;
  const wasAssignedBefore = !!issue.assignedWorkerId;
  const isAuto = method === "AUTO";

  const note = `${isReassign ? "Reassigned" : "Assigned"} to ${worker.name} (${department})${
    isAuto ? " — Automatic Assignment" : adminName ? ` by ${adminName}` : ""
  }.`;

  const patch = {
    assignedWorkerId: worker.id,
    assignedWorker: worker.name,
    assignedDepartment: department,
    assignedAt: new Date().toISOString(),
    assignedBy: isAuto ? "System (Auto Assign)" : adminName || null,
    assignmentMethod: method,
  };

  if (!wasAssignedBefore) {
    // First-time assignment: this is a genuine status change to ASSIGNED,
    // so it belongs in the normal lifecycle timeline.
    patch.status = ISSUE_STATUS.ASSIGNED;
    patch.statusNote = note;
  } else {
    // Reassignment (including re-assigning after a Reopen): the issue's
    // lifecycle status doesn't change, but the reassignment itself is
    // still recorded as its own timeline entry.
    patch.timelineEvent = { status: "REASSIGNED", note };
    // A reopened issue being (re)assigned moves back into the active queue.
    if (issue.status === ISSUE_STATUS.REOPENED) {
      patch.status = ISSUE_STATUS.ASSIGNED;
      patch.statusNote = note;
    }
  }

  const updated = updateIssue(issueId, patch);
  if (updated) {
    createNotification({
      recipientId: worker.id,
      recipientRole: "worker",
      type: NOTIFICATION_TYPES.ISSUE_ASSIGNED,
      message: isAuto
        ? `Issue #${issueId} has been automatically assigned to you.`
        : `Issue #${issueId} has been ${isReassign ? "reassigned" : "assigned"} to ${worker.name}.`,
      relatedId: issueId,
      relatedType: "issue",
    });
    createNotification({
      recipientRole: "admin",
      type: NOTIFICATION_TYPES.ISSUE_ASSIGNED,
      message: isAuto
        ? `Issue #${issueId} automatically assigned to ${worker.name} (${department}).`
        : `Issue #${issueId} ${isReassign ? "reassigned" : "assigned"} to ${worker.name} (${department}).`,
      relatedId: issueId,
      relatedType: "issue",
    });
  }
  return updated;
}

/** Admin-driven priority change. Doesn't touch the timeline — priority is
 * shown directly on the issue and in the table, not as a lifecycle stage. */
export function changeIssuePriority(issueId, priority, adminName) {
  const updated = updateIssue(issueId, { priority, priorityChangedBy: adminName || null });
  if (updated) {
    startMaintenanceIfCritical(updated);
    liftMaintenanceIfDowngraded(updated);
  }
  return updated;
}

/** Admin-driven status change (e.g. manually moving an issue along its
 * lifecycle). Goes through the normal status-history path in updateIssue
 * since the status is genuinely changing. */
export function changeIssueStatus(issueId, status, adminName) {
  return updateIssue(issueId, {
    status,
    statusNote: `Status changed to ${String(status).replace(/_/g, " ")}${adminName ? ` by ${adminName}` : ""}.`,
  });
}

/** Resolves an issue directly from the admin side (as opposed to
 * resolveIssueByWorker, which enforces that the acting worker owns the
 * issue). Used for admin overrides / issues without an assigned worker. */
export function resolveIssueByAdmin(issueId, adminName, { resolutionNotes, resolutionPhoto } = {}) {
  const now = new Date().toISOString();
  const updated = updateIssue(issueId, {
    status: ISSUE_STATUS.RESOLVED,
    statusNote: `Resolved by admin${adminName ? ` (${adminName})` : ""}.`,
    resolutionNotes: resolutionNotes || "",
    resolutionPhoto: resolutionPhoto || null,
    resolvedBy: adminName ? `${adminName} (Admin)` : "Admin",
    resolvedAt: now,
  });
  if (updated) completeMaintenanceIfBlocked(updated);
  return updated;
}

/** Reopens a resolved/closed issue. Resolution notes/photo are deliberately
 * left in place (not cleared) so the previous resolution history is
 * preserved exactly as the spec requires — reopening only moves the
 * status forward into REOPENED, ready to be (re)assigned. */
export function reopenIssue(issueId, adminName, note) {
  const updated = updateIssue(issueId, {
    status: ISSUE_STATUS.REOPENED,
    statusNote: `Reopened${adminName ? ` by ${adminName}` : ""}.${note ? ` ${note}` : ""}`,
  });
  // A reopened CRITICAL issue re-triggers maintenance if the room isn't
  // already unavailable for some other reason (e.g. it was auto-unblocked
  // when this same issue was previously resolved).
  if (updated) startMaintenanceIfCritical(updated);
  return updated;
}

/** Blocks the room tied to an issue for maintenance, and records the block
 * as a timeline event on the issue so the connection is visible without
 * changing the issue's own lifecycle status. Room-level details (blocked
 * flag, reason, related issue id) live in roomStatusStorage.js — booking
 * records are never touched or deleted. */
export function blockRoomForIssue(issueId, { roomName, reason, adminName }) {
  const note = `Room ${roomName} blocked for maintenance${adminName ? ` by ${adminName}` : ""}: ${reason}`;
  const updated = updateIssue(issueId, {
    timelineEvent: { status: "ROOM_BLOCKED", note },
  });
  if (updated) {
    createNotification({
      recipientRole: "admin",
      type: NOTIFICATION_TYPES.MAINTENANCE_STARTED,
      message: `Room maintenance started on ${roomName} (Issue #${issueId}).`,
      relatedId: issueId,
      relatedType: "issue",
    });
  }
  return updated;
}

export function isIssueOverdue(issue) {
  if (!issue) return false;
  if (issue.status === ISSUE_STATUS.RESOLVED || issue.status === ISSUE_STATUS.CLOSED) return false;
  const ageMs = Date.now() - new Date(issue.createdDate).getTime();
  return ageMs > OVERDUE_THRESHOLD_HOURS * 60 * 60 * 1000;
}

function isSameCalendarDay(isoA, isoB) {
  if (!isoA || !isoB) return false;
  const a = new Date(isoA);
  const b = new Date(isoB);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isResolvedToday(issue) {
  if (!issue) return false;
  if (issue.status !== ISSUE_STATUS.RESOLVED && issue.status !== ISSUE_STATUS.CLOSED) return false;
  return isSameCalendarDay(issue.resolvedAt || issue.lastUpdated, new Date().toISOString());
}

/** Moves an issue from ASSIGNED to IN_PROGRESS. Refuses (returns null) if
 * the issue isn't assigned to this worker, enforcing worker permissions at
 * the storage layer as well as in the UI. */
export function startWork(issueId, worker) {
  const issue = getIssueById(issueId);
  if (!issue || issue.assignedWorkerId !== worker.id) return null;
  if (issue.status !== ISSUE_STATUS.ASSIGNED) return issue;
  return updateIssue(issueId, {
    status: ISSUE_STATUS.IN_PROGRESS,
    statusNote: `Work started by ${worker.name}.`,
  });
}

/** Moves an issue from IN_PROGRESS to RESOLVED, recording the resolution
 * description/photo and who resolved it. Refuses (returns null) if the
 * issue isn't assigned to this worker. */
export function resolveIssueByWorker(issueId, worker, { resolutionDescription, resolutionPhoto }) {
  const issue = getIssueById(issueId);
  if (!issue || issue.assignedWorkerId !== worker.id) return null;
  const now = new Date().toISOString();
  const updated = updateIssue(issueId, {
    status: ISSUE_STATUS.RESOLVED,
    statusNote: `Resolved by ${worker.name}.`,
    resolutionNotes: resolutionDescription,
    resolutionPhoto: resolutionPhoto || null,
    resolvedBy: worker.name,
    resolvedAt: now,
  });
  if (updated) completeMaintenanceIfBlocked(updated);
  return updated;
}

/** Seeds a handful of realistic issues already assigned to the given
 * worker, the first time that worker's queue is opened. Mirrors
 * seedEmployeeBookingsIfEmpty() in bookingStorage.js — keyed to one user
 * rather than running unconditionally, and a strict no-op once that worker
 * already has anything assigned, so it never overwrites real activity. */
export function seedWorkerIssuesIfEmpty(workerId, workerName) {
  let list = readAll();
  let changed = false;
  const seenSeedIds = new Set();
  list = list.filter((issue) => {
    if (!/^ISS-SEED\d+$/.test(issue.id || "")) return true;
    if (seenSeedIds.has(issue.id)) {
      changed = true;
      return false;
    }
    seenSeedIds.add(issue.id);
    const department = suggestDepartment(issue.category);
    const correctWorker = pickWorkerForDepartment(department);
    if (correctWorker && (issue.assignedWorkerId !== correctWorker.id || issue.assignedDepartment !== department)) {
      issue.assignedWorkerId = correctWorker.id;
      issue.assignedWorker = correctWorker.name;
      issue.assignedDepartment = department;
      issue.assignmentMethod = "AUTO";
      changed = true;
    }
    return true;
  });
  if (changed) writeAll(list);
  const alreadyAssigned = list.some((i) => i.assignedWorkerId === workerId);
  if (alreadyAssigned) return;

  const reporter = MOCK_USERS.find((u) => u.role === ROLES.EMPLOYEE) || {
    id: "u-003",
    name: "Rohan Iyer",
    organization: "IT Park Internal Staff",
  };

  const hoursAgo = (n) => new Date(Date.now() - n * 3600 * 1000).toISOString();

  function buildHistory(stages) {
    // stages: [{ status, at, note }] in chronological order
    return stages.map((s) => ({ status: s.status, at: s.at, note: s.note || "" }));
  }

  const defs = [
    {
      id: "ISS-SEED01",
      roomId: "r-101",
      roomName: "Orion Boardroom",
      category: "AC",
      categoryGroup: "FACILITIES",
      priority: PRIORITY.HIGH,
      description: "AC unit is blowing warm air — the room heats up fast during longer meetings.",
      createdDate: hoursAgo(50),
      status: ISSUE_STATUS.ASSIGNED,
      stages: [
        { status: ISSUE_STATUS.OPEN, at: hoursAgo(50) },
        { status: ISSUE_STATUS.ASSIGNED, at: hoursAgo(49), note: `Assigned to ${workerName}.` },
      ],
    },
    {
      id: "ISS-SEED02",
      roomId: "r-102",
      roomName: "Nebula Meeting Room",
      category: "WiFi",
      categoryGroup: "TECHNICAL",
      priority: PRIORITY.MEDIUM,
      description: "WiFi keeps dropping every few minutes, making video calls unusable.",
      createdDate: hoursAgo(3),
      status: ISSUE_STATUS.ASSIGNED,
      stages: [
        { status: ISSUE_STATUS.OPEN, at: hoursAgo(3) },
        { status: ISSUE_STATUS.ASSIGNED, at: hoursAgo(2.5), note: `Assigned to ${workerName}.` },
      ],
    },
    {
      id: "ISS-SEED03",
      roomId: "r-201",
      roomName: "Zenith Conference Hall",
      category: "Electricity",
      categoryGroup: "FACILITIES",
      priority: PRIORITY.CRITICAL,
      description: "One full bank of ceiling lights and both wall sockets near the stage are dead.",
      createdDate: hoursAgo(26),
      status: ISSUE_STATUS.IN_PROGRESS,
      stages: [
        { status: ISSUE_STATUS.OPEN, at: hoursAgo(26) },
        { status: ISSUE_STATUS.ASSIGNED, at: hoursAgo(25), note: `Assigned to ${workerName}.` },
        { status: ISSUE_STATUS.IN_PROGRESS, at: hoursAgo(20), note: `Work started by ${workerName}.` },
      ],
    },
    {
      id: "ISS-SEED04",
      roomId: "r-203",
      roomName: "Pixel Huddle Room",
      category: "Furniture",
      categoryGroup: "FACILITIES",
      priority: PRIORITY.LOW,
      description: "One of the four chairs has a broken wheel and won't roll properly.",
      createdDate: hoursAgo(5),
      status: ISSUE_STATUS.IN_PROGRESS,
      stages: [
        { status: ISSUE_STATUS.OPEN, at: hoursAgo(5) },
        { status: ISSUE_STATUS.ASSIGNED, at: hoursAgo(4.5), note: `Assigned to ${workerName}.` },
        { status: ISSUE_STATUS.IN_PROGRESS, at: hoursAgo(2), note: `Work started by ${workerName}.` },
      ],
    },
    {
      id: "ISS-SEED05",
      roomId: "r-301",
      roomName: "Skyline Training Room",
      category: "Projector",
      categoryGroup: "TECHNICAL",
      priority: PRIORITY.MEDIUM,
      description: "Projector image has a persistent green tint regardless of the input source.",
      createdDate: hoursAgo(22),
      status: ISSUE_STATUS.RESOLVED,
      resolutionNotes: "Reseated the HDMI cable and reset the projector's color calibration. Image is clean now.",
      resolvedAt: hoursAgo(1),
      stages: [
        { status: ISSUE_STATUS.OPEN, at: hoursAgo(22) },
        { status: ISSUE_STATUS.ASSIGNED, at: hoursAgo(21), note: `Assigned to ${workerName}.` },
        { status: ISSUE_STATUS.IN_PROGRESS, at: hoursAgo(4), note: `Work started by ${workerName}.` },
        { status: ISSUE_STATUS.RESOLVED, at: hoursAgo(1), note: `Resolved by ${workerName}.` },
      ],
    },
    {
      id: "ISS-SEED06",
      roomId: "r-302",
      roomName: "Aurora Interview Room",
      category: "Plumbing",
      categoryGroup: "FACILITIES",
      priority: PRIORITY.HIGH,
      description: "Slow leak under the sink in the adjoining washroom is pooling water on the floor.",
      createdDate: hoursAgo(70),
      status: ISSUE_STATUS.RESOLVED,
      resolutionNotes: "Replaced the worn supply-line washer and dried out the cabinet base. No more leak after a 24h check.",
      resolvedAt: hoursAgo(28),
      stages: [
        { status: ISSUE_STATUS.OPEN, at: hoursAgo(70) },
        { status: ISSUE_STATUS.ASSIGNED, at: hoursAgo(69), note: `Assigned to ${workerName}.` },
        { status: ISSUE_STATUS.IN_PROGRESS, at: hoursAgo(48), note: `Work started by ${workerName}.` },
        { status: ISSUE_STATUS.RESOLVED, at: hoursAgo(28), note: `Resolved by ${workerName}.` },
      ],
    },
  ];

  const workerDepartment = getWorkerById(workerId)?.department;
  const workerDefs = workerDepartment
    ? defs.filter((issue) => suggestDepartment(issue.category) === workerDepartment)
    : [];
  const seeded = workerDefs.map((d) => {
    const lastStage = d.stages[d.stages.length - 1];
    return {
      id: d.id,
      employeeId: reporter.id,
      employeeName: reporter.name,
      organization: reporter.organization || "IT Park Internal Staff",
      bookingId: `${d.id.replace("ISS-", "BKG-")}`,
      roomId: d.roomId,
      roomName: d.roomName,
      category: d.category,
      categoryGroup: d.categoryGroup,
      description: d.description,
      priority: d.priority,
      photo: null,
      status: d.status,
      createdDate: d.createdDate,
      lastUpdated: lastStage.at,
      assignedWorkerId: workerId,
      assignedWorker: workerName,
      resolutionNotes: d.resolutionNotes || "",
      resolutionPhoto: null,
      resolvedBy: d.status === ISSUE_STATUS.RESOLVED ? workerName : null,
      resolvedAt: d.resolvedAt || null,
      statusHistory: buildHistory(d.stages),
    };
  });

  writeAll([...list, ...seeded]);
}
