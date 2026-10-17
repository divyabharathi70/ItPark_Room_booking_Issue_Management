// The client "Raise Issue" flow reuses the exact same form/component the
// employee flow uses — see pages/employee/RaiseIssue.jsx, which is
// role-aware (base paths, eyebrow, and dashboard link all derive from
// the logged-in user's role) so nothing needs duplicating here.
export { default } from "../employee/RaiseIssue";
