import type { Metadata } from "next";
import { AuthForm } from "@/src/components/auth-form";
export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <AuthForm mode="reset" token={(await searchParams).token} />;
}

