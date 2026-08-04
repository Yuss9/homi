import { cookies } from "next/headers";
import { AppShell } from "@/src/components/app-shell";
import {
  resolveSelectedHomeId,
  selectedHomeCookie,
} from "@/src/features/homes/selection";
import { requireVerifiedPageUser } from "@/src/server/authorization/page";
import { profileAvatarUrl } from "@/src/server/profile/avatar";
import { getExperiencePreferences } from "@/src/server/services/experience";
import { listHomes } from "@/src/server/services/homes";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireVerifiedPageUser();
  const [homes, experience] = await Promise.all([
    listHomes(session.user.id),
    getExperiencePreferences(session.user.id),
  ]);
  const selectedHomeId = resolveSelectedHomeId(
    homes,
    (await cookies()).get(selectedHomeCookie)?.value,
  );

  return (
    <AppShell
      user={{
        name: session.user.name,
        email: session.user.email,
        avatarUrl: profileAvatarUrl(session.user.id, session.user.image),
      }}
      homes={homes}
      selectedHomeId={selectedHomeId}
      locale={experience.locale}
    >
      {children}
    </AppShell>
  );
}
