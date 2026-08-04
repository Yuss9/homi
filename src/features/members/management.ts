export type HouseholdRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

type Actor = { userId: string; role: HouseholdRole };
type Target = { userId: string; role: HouseholdRole };

export function membershipChangeReason(
  actor: Actor,
  target: Target,
  desiredRole?: Exclude<HouseholdRole, "OWNER">,
) {
  if (actor.role !== "OWNER" && actor.role !== "ADMIN")
    return "Only household managers can change access.";
  if (target.role === "OWNER")
    return "The home owner cannot be changed or removed here.";
  if (target.userId === actor.userId)
    return "You cannot change your own household access here.";
  if (actor.role === "ADMIN" && target.role === "ADMIN")
    return "Only the owner can manage another admin.";
  if (desiredRole === "ADMIN" && actor.role !== "OWNER")
    return "Only the owner can promote an admin.";
  return null;
}
