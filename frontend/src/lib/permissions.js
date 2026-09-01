export function getAppPermission(user, appId, section) {
  if (!user) return "none";
  if (user.portal_role === "super_admin") return "edit";
  const perm = (user.app_permissions || []).find((p) => p.app_id === appId);
  return perm ? perm[section] || "none" : "none";
}

export function hasAnyAppAccess(user, appId) {
  if (!user) return false;
  if (user.portal_role === "super_admin") return true;
  const perm = (user.app_permissions || []).find((p) => p.app_id === appId);
  if (!perm) return false;
  return ["logs", "settings", "users", "db"].some((s) => perm[s] && perm[s] !== "none");
}
