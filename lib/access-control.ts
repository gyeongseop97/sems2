export type SemsRole = "admin" | "editor" | "viewer";
export type StoredSemsRole = SemsRole | "manager";

export const SEMS_ROLES: SemsRole[] = ["admin", "editor", "viewer"];

export const SEMS_ROLE_LABELS: Record<SemsRole, string> = {
  admin: "관리자",
  editor: "자료 입력자",
  viewer: "조회자",
};

export function normalizeSemsRole(role: unknown): SemsRole {
  // Older SEMS workspaces used `manager` for the group-wide reviewer. The
  // three-role model folds that legacy role into administrator access.
  if (role === "admin" || role === "manager") return "admin";
  if (role === "editor") return "editor";
  return "viewer";
}

export function isAdminRole(role: unknown) {
  return normalizeSemsRole(role) === "admin";
}

export function canWriteRequestedData(role: unknown) {
  const normalized = normalizeSemsRole(role);
  return normalized === "admin" || normalized === "editor";
}
