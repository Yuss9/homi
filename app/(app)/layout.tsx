import { redirect } from "next/navigation";
import { AppShell } from "@/src/components/app-shell";
import { requireVerifiedUser } from "@/src/server/authorization";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await requireVerifiedUser();
  } catch {
    redirect("/sign-in");
  }
  return <AppShell user={{ name: session.user.name, email: session.user.email }}>{children}</AppShell>;
}
