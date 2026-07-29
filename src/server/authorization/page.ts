import "server-only";
import { redirect } from "next/navigation";
import { getOptionalSession } from ".";

export async function requireVerifiedPageUser() {
  const current = await getOptionalSession();
  if (!current) redirect("/sign-in");
  if (!current.user.emailVerified) redirect("/verify-email");
  return current;
}
