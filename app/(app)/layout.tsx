import { AppShell } from "@/src/components/app-shell";
import { requireVerifiedPageUser } from "@/src/server/authorization/page";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireVerifiedPageUser();

  return (
    <AppShell user={{ name: session.user.name, email: session.user.email }}>
      {children}
    </AppShell>
  );
}
