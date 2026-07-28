import { redirect } from "next/navigation";
import { AppShell } from "@/src/components/app-shell";
import { getOptionalSession } from "@/src/server/authorization";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOptionalSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (!session.user.emailVerified) {
    redirect("/verify-email");
  }

  return (
    <AppShell user={{ name: session.user.name, email: session.user.email }}>
      {children}
    </AppShell>
  );
}
