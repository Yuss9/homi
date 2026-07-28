import type { Metadata } from "next";
import { InfoPage } from "@/src/components/info-page";
export const metadata: Metadata = { title: "How it works", description: "See how Homi turns home information into a useful maintenance journal.", alternates: { canonical: "/how-it-works" } };
export default function Page() { return <InfoPage eyebrow="How it works" title="A useful record from day one." intro="Start with one home and add detail only when it becomes useful."><h2>1. Make your home</h2><p>Add a name, timezone, and the rooms you want to organize. Address details are optional.</p><h2>2. Add the things worth remembering</h2><p>Capture an appliance, upload its manual or invoice, and add a warranty date. Homi turns scattered details into a durable record.</p><h2>3. Put maintenance on a rhythm</h2><p>Choose when work is due and how often it returns. Homi reminds the right people and records every completion.</p></InfoPage>; }

