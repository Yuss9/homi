import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { FileText, Package, Wrench } from "lucide-react";
import { db } from "@/db";
import { assets, documents, homeMembers, maintenanceRecords, repairRecords } from "@/db/schema";
import { requireVerifiedUser } from "@/src/server/authorization";

export const metadata = { title: "Asset details" };

export default async function Page({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const session = await requireVerifiedUser();
  const [asset] = await db
    .select({ asset: assets })
    .from(assets)
    .innerJoin(homeMembers, eq(homeMembers.homeId, assets.homeId))
    .where(and(eq(assets.id, assetId), eq(homeMembers.userId, session.user.id)))
    .limit(1);
  if (!asset) notFound();
  const [maintenance, repairs, files] = await Promise.all([
    db.select().from(maintenanceRecords).where(eq(maintenanceRecords.assetId, assetId)).orderBy(desc(maintenanceRecords.completedAt)).limit(20),
    db.select().from(repairRecords).where(eq(repairRecords.assetId, assetId)).orderBy(desc(repairRecords.createdAt)).limit(20),
    db.select().from(documents).where(eq(documents.assetId, assetId)).orderBy(desc(documents.createdAt)).limit(20),
  ]);
  const item = asset.asset;
  return (
    <main id="main" className="app-main">
      <div className="dashboard-head"><div><small>{item.category}</small><h1>{item.name}</h1><p>{[item.brand, item.model, item.serialNumber].filter(Boolean).join(" · ") || "No identifying details added yet."}</p></div><span className="button button-secondary"><Package size={16} />{item.status.replaceAll("_", " ").toLowerCase()}</span></div>
      <div className="dash-grid" style={{ marginTop: 32 }}>
        <section className="dash-card"><div className="dash-card-head"><h2>Details</h2><Package size={17} /></div><dl className="detail-list"><div><dt>Purchase date</dt><dd>{item.purchaseDate || "—"}</dd></div><div><dt>Warranty ends</dt><dd>{item.warrantyEndDate || "—"}</dd></div><div><dt>Installation date</dt><dd>{item.installationDate || "—"}</dd></div><div><dt>Expected life</dt><dd>{item.expectedLifetimeYears ? `${item.expectedLifetimeYears} years` : "—"}</dd></div></dl></section>
        <section className="dash-card"><div className="dash-card-head"><h2>Timeline</h2><Wrench size={17} /></div>{maintenance.map((record) => <div className="dash-task" key={record.id}><span><Wrench size={16} /></span><div><strong>Maintenance completed</strong><small>{record.notes || "No notes"}</small></div><time>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(record.completedAt)}</time></div>)}{repairs.map((repair) => <div className="dash-task" key={repair.id}><span><Wrench size={16} /></span><div><strong>{repair.title}</strong><small>{repair.status.toLowerCase()}</small></div></div>)}{files.map((file) => <div className="dash-task" key={file.id}><span><FileText size={16} /></span><div><strong>{file.title}</strong><small>{file.type.toLowerCase()}</small></div></div>)}{!maintenance.length && !repairs.length && !files.length && <p className="muted-copy">Maintenance, repairs, and attached documents will appear here.</p>}</section>
      </div>
    </main>
  );
}
