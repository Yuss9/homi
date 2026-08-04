import { cookies } from "next/headers";
import { AppShell } from "@/src/components/app-shell";
import {
  resolveSelectedHomeId,
  selectedHomeCookie,
} from "@/src/features/homes/selection";
import { requireVerifiedPageUser } from "@/src/server/authorization/page";
import { listHomes } from "@/src/server/services/homes";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireVerifiedPageUser();
  const homes = await listHomes(session.user.id);
  const selectedHomeId = resolveSelectedHomeId(
    homes,
    (await cookies()).get(selectedHomeCookie)?.value,
  );

  return (
    <AppShell
      user={{ name: session.user.name, email: session.user.email }}
      homes={homes}
      selectedHomeId={selectedHomeId}
    >
      {children}
    </AppShell>
  );
}
