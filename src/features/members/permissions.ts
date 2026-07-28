export const roles = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;
export type HomeRole = (typeof roles)[number];
export const permissionMatrix = {
  view: roles,
  manageHome: ["OWNER", "ADMIN"],
  manageMembers: ["OWNER", "ADMIN"],
  transferOwnership: ["OWNER"],
  deleteHome: ["OWNER"],
  manageAssets: ["OWNER", "ADMIN"],
  createMaintenanceRecord: ["OWNER", "ADMIN", "MEMBER"],
  addLimitedDocument: ["OWNER", "ADMIN", "MEMBER"],
  viewPrivateDocument: roles,
} as const satisfies Record<string, readonly HomeRole[]>;
export function hasPermission(role: HomeRole, permission: keyof typeof permissionMatrix) {
  return (permissionMatrix[permission] as readonly HomeRole[]).includes(role);
}

