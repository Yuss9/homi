import type { Metadata } from "next";
import { AuthForm } from "@/src/components/auth-form";
export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };
export default function Page() { return <AuthForm mode="sign-up" />; }

