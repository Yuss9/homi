import type { Metadata } from "next";
import { AuthForm } from "@/src/components/auth-form";
export const metadata: Metadata = { title: "Verify email", robots: { index: false, follow: false } };
export default function Page() { return <AuthForm mode="resend" />; }

