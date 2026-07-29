import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { CalendarDays, FileText, Package, Plus, ShieldCheck, Wrench } from "lucide-react";
import { db } from "@/db";
import { assets, homeMembers, homes, maintenanceTasks, notifications } from "@/db/schema";
import { CalmStatus } from "@/src/components/app-shell";
import { requireVerifiedPageUser } from "@/src/server/authorization/page";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireVerifiedPageUser();
  const [membership] = await db.select({ home: homes }).from(homeMembers).innerJoin(homes, eq(homes.id, homeMembers.homeId)).where(and(eq(homeMembers.userId, session.user.id), isNull(homes.archivedAt))).limit(1);
  const homeId = membership?.home.id;
  const upcoming = homeId ? await db.select().from(maintenanceTasks).where(and(eq(maintenanceTasks.homeId, homeId), isNull(maintenanceTasks.archivedAt))).orderBy(asc(maintenanceTasks.nextDueAt)).limit(3) : [];
  const assetRows = homeId ? await db.select({ id: assets.id }).from(assets).where(and(eq(assets.homeId, homeId), isNull(assets.archivedAt))).limit(100) : [];
  const unread = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, session.user.id), isNull(notifications.readAt), isNull(notifications.dismissedAt))).limit(100);
  return (
    <main id="main" className="app-main">
      <div className="dashboard-head"><div><small>{new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(new Date())}</small><h1>Good morning, {session.user.name.split(" ")[0]}.</h1><p>{membership ? `${membership.home.name} is ready for the day.` : "Let’s create your first home journal."}</p></div><Link className="button" href={membership ? "/assets" : "/onboarding"}><Plus size={16} />{membership ? "Add something" : "Start setup"}</Link></div>
      <CalmStatus />
      <div className="dash-grid">
        <section className="dash-card">
          <div className="dash-card-head"><h2>Coming up</h2><Link href="/maintenance">View calendar</Link></div>
          {upcoming.length ? upcoming.map((task) => <div className="dash-task" key={task.id}><span><Wrench size={16} /></span><div><strong>{task.title}</strong><small>{task.priority.toLowerCase()} priority</small></div><time>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(task.nextDueAt)}</time></div>) : <div className="dash-task"><span><CalendarDays size={16} /></span><div><strong>No maintenance due</strong><small>Your schedule is clear.</small></div></div>}
        </section>
        <section className="dash-card">
          <div className="dash-card-head"><h2>At a glance</h2><Link href="/assets">Open home</Link></div>
          <div className="summary-grid">
            <div className="summary-cell"><Package size={16} /><strong>{assetRows.length}</strong><span>Assets</span></div>
            <div className="summary-cell"><CalendarDays size={16} /><strong>{upcoming.length}</strong><span>Upcoming</span></div>
            <div className="summary-cell"><FileText size={16} /><strong>—</strong><span>Documents</span></div>
            <div className="summary-cell"><ShieldCheck size={16} /><strong>{unread.length}</strong><span>Notices</span></div>
          </div>
        </section>
      </div>
    </main>
  );
}
