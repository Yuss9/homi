import type { Metadata } from "next";
import { InfoPage } from "@/src/components/info-page";
export const metadata: Metadata = { title: "Contact", description: "Contact the Homi team.", alternates: { canonical: "/contact" } };
export default function Page() { const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@homi.local"; return <InfoPage eyebrow="Contact" title="We’re here to help." intro="Questions about your journal, privacy, or self-hosting are welcome."><h2>Email</h2><p><a className="inline-link" href={`mailto:${email}`}>{email}</a></p><p>Please do not include passwords, authentication tokens, or sensitive home documents in support email.</p></InfoPage>; }

