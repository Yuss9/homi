import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { user } from "@/db/schema";
import { OnboardingFlow } from "@/src/components/onboarding-flow";
import { getOptionalSession } from "@/src/server/authorization";
export const metadata = {
  title: "Set up your home",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page() {
  const session = await getOptionalSession();
  if (!session) redirect("/sign-in?returnTo=/onboarding");
  if (!session.user.emailVerified) redirect("/verify-email");
  const [profile] = await db
    .select({ step: user.onboardingStep })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  return <OnboardingFlow initialStep={profile?.step ?? 0} />;
}
