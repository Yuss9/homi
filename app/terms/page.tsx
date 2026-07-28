import type { Metadata } from "next";
import { InfoPage } from "@/src/components/info-page";
export const metadata: Metadata = { title: "Terms", description: "Homi terms of service placeholder.", alternates: { canonical: "/terms" } };
export default function Page() { return <InfoPage eyebrow="Terms" title="Simple terms, in progress." intro="This is a production placeholder and should be reviewed by qualified counsel before a public launch."><h2>Using Homi</h2><p>Use Homi lawfully and keep your account credentials secure. You retain ownership of the information and files you add.</p><h2>No professional advice</h2><p>Homi helps organize information and reminders. It does not replace qualified electrical, structural, legal, safety, or other professional advice.</p><h2>Self-hosting</h2><p>Self-hosted operators are responsible for infrastructure security, backups, data protection obligations, and their own user-facing policies.</p></InfoPage>; }

