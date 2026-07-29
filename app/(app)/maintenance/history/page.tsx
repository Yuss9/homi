import { desc, eq } from "drizzle-orm";
import { CheckCircle2, History } from "lucide-react";
import { db } from "@/db";
import { homeMembers, maintenanceRecords, maintenanceTasks } from "@/db/schema";
import { requireVerifiedPageUser } from "@/src/server/authorization/page";

export const metadata = { title: "Maintenance history" };

export default async function Page() {
  const session = await requireVerifiedPageUser();
  const records = await db
    .select({
      id: maintenanceRecords.id,
      completedAt: maintenanceRecords.completedAt,
      notes: maintenanceRecords.notes,
      cost: maintenanceRecords.cost,
      currency: maintenanceRecords.currency,
      serviceProvider: maintenanceRecords.serviceProvider,
      taskTitle: maintenanceTasks.title,
    })
    .from(maintenanceRecords)
    .innerJoin(homeMembers, eq(homeMembers.homeId, maintenanceRecords.homeId))
    .leftJoin(maintenanceTasks, eq(maintenanceTasks.id, maintenanceRecords.taskId))
    .where(eq(homeMembers.userId, session.user.id))
    .orderBy(desc(maintenanceRecords.completedAt))
    .limit(100);
  return (
    <main id="main" className="app-main">
      <div className="dashboard-head"><div><small>Permanent record</small><h1>Maintenance history</h1><p>Completed work, notes, providers, and costs across your homes.</p></div></div>
      <section className="dash-card resource-list-card">
        <div className="dash-card-head"><h2>Completed work</h2><History size={17} /></div>
        {records.map((record) => (
          <article className="dash-task" key={record.id}><span><CheckCircle2 size={16} /></span><div><strong>{record.taskTitle || "Maintenance record"}</strong><small>{record.notes || record.serviceProvider || "No notes added"}</small></div><time>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(record.completedAt)}{record.cost ? ` · ${record.cost} ${record.currency}` : ""}</time></article>
        ))}
        {!records.length && <p className="muted-copy">Completed maintenance will appear here.</p>}
      </section>
    </main>
  );
}
