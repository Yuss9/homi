import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/src/components/auth-form";
import { getOptionalSession } from "@/src/server/authorization";
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const session = await getOptionalSession();
  if (session?.user.emailVerified) redirect("/dashboard");
  if (session) redirect("/verify-email");
  return <AuthForm mode="sign-in" returnTo={(await searchParams).returnTo} />;
}
