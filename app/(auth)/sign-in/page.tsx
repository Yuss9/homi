import type { Metadata } from "next";
import { AuthForm } from "@/src/components/auth-form";
export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  return <AuthForm mode="sign-in" returnTo={(await searchParams).returnTo} />;
}

