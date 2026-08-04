import Link from "next/link";
import { cookies } from "next/headers";
import {
  and,
  asc,
  count,
  eq,
  isNull,
  lt,
  ne,
  or,
} from "drizzle-orm";
import {
  CalendarDays,
  FileText,
  Package,
  Plus,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { db } from "@/db";
import {
  assets,
  documents,
  homeMembers,
  homes,
  maintenanceTasks,
  notifications,
  repairRecords,
} from "@/db/schema";
import { CalmStatus } from "@/src/components/app-shell";
import {
  calculateHomeHealth,
  getDashboardGreeting,
  getDateKey,
} from "@/src/features/dashboard/health";
import {
  resolveSelectedHomeId,
  selectedHomeCookie,
} from "@/src/features/homes/selection";
import { requireVerifiedPageUser } from "@/src/server/authorization/page";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireVerifiedPageUser();
  const memberships = await db
    .select({ home: homes })
    .from(homeMembers)
    .innerJoin(homes, eq(homes.id, homeMembers.homeId))
    .where(
      and(
        eq(homeMembers.userId, session.user.id),
        isNull(homes.archivedAt),
      ),
    );
  const selectedHomeId = resolveSelectedHomeId(
    memberships.map(({ home }) => home),
    (await cookies()).get(selectedHomeCookie)?.value,
  );
  const membership = memberships.find(({ home }) => home.id === selectedHomeId);
  const homeId = membership?.home.id;
  const timeZone = membership?.home.timezone ?? "UTC";
  const now = new Date();
  const today = getDateKey(now, timeZone);

  let upcoming: (typeof maintenanceTasks.$inferSelect)[] = [];
  let metrics = {
    assets: 0,
    tasks: 0,
    documents: 0,
    unread: 0,
    overdueTasks: 0,
    criticalOverdueTasks: 0,
    attentionAssets: 0,
    openRepairs: 0,
    expiredDocuments: 0,
  };

  if (homeId) {
    const [
      upcomingRows,
      assetCountRows,
      taskCountRows,
      documentCountRows,
      unreadRows,
      overdueRows,
      criticalOverdueRows,
      attentionAssetRows,
      openRepairRows,
      expiredDocumentRows,
    ] = await Promise.all([
      db
        .select()
        .from(maintenanceTasks)
        .where(
          and(
            eq(maintenanceTasks.homeId, homeId),
            isNull(maintenanceTasks.archivedAt),
          ),
        )
        .orderBy(asc(maintenanceTasks.nextDueAt))
        .limit(3),
      db
        .select({ value: count() })
        .from(assets)
        .where(and(eq(assets.homeId, homeId), isNull(assets.archivedAt))),
      db
        .select({ value: count() })
        .from(maintenanceTasks)
        .where(
          and(
            eq(maintenanceTasks.homeId, homeId),
            isNull(maintenanceTasks.archivedAt),
          ),
        ),
      db
        .select({ value: count() })
        .from(documents)
        .where(eq(documents.homeId, homeId)),
      db
        .select({ value: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, session.user.id),
            or(eq(notifications.homeId, homeId), isNull(notifications.homeId)),
            isNull(notifications.readAt),
            isNull(notifications.dismissedAt),
          ),
        ),
      db
        .select({ value: count() })
        .from(maintenanceTasks)
        .where(
          and(
            eq(maintenanceTasks.homeId, homeId),
            isNull(maintenanceTasks.archivedAt),
            lt(maintenanceTasks.nextDueAt, now),
          ),
        ),
      db
        .select({ value: count() })
        .from(maintenanceTasks)
        .where(
          and(
            eq(maintenanceTasks.homeId, homeId),
            isNull(maintenanceTasks.archivedAt),
            lt(maintenanceTasks.nextDueAt, now),
            eq(maintenanceTasks.priority, "CRITICAL"),
          ),
        ),
      db
        .select({ value: count() })
        .from(assets)
        .where(
          and(
            eq(assets.homeId, homeId),
            isNull(assets.archivedAt),
            or(
              eq(assets.status, "NEEDS_ATTENTION"),
              eq(assets.status, "UNDER_REPAIR"),
            ),
          ),
        ),
      db
        .select({ value: count() })
        .from(repairRecords)
        .where(
          and(
            eq(repairRecords.homeId, homeId),
            ne(repairRecords.status, "COMPLETED"),
            ne(repairRecords.status, "CANCELLED"),
          ),
        ),
      db
        .select({ value: count() })
        .from(documents)
        .where(
          and(
            eq(documents.homeId, homeId),
            lt(documents.expiryDate, today),
          ),
        ),
    ]);

    upcoming = upcomingRows;
    metrics = {
      assets: assetCountRows[0]?.value ?? 0,
      tasks: taskCountRows[0]?.value ?? 0,
      documents: documentCountRows[0]?.value ?? 0,
      unread: unreadRows[0]?.value ?? 0,
      overdueTasks: overdueRows[0]?.value ?? 0,
      criticalOverdueTasks: criticalOverdueRows[0]?.value ?? 0,
      attentionAssets: attentionAssetRows[0]?.value ?? 0,
      openRepairs: openRepairRows[0]?.value ?? 0,
      expiredDocuments: expiredDocumentRows[0]?.value ?? 0,
    };
  }

  const health = calculateHomeHealth({
    overdueTasks: metrics.overdueTasks,
    criticalOverdueTasks: metrics.criticalOverdueTasks,
    openRepairs: metrics.openRepairs,
    attentionAssets: metrics.attentionAssets,
    expiredDocuments: metrics.expiredDocuments,
  });
  const greeting = getDashboardGreeting(now, timeZone);
  const dateLabel = new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeZone,
  }).format(now);

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div>
          <small>{dateLabel}</small>
          <h1>
            {greeting}, {session.user.name.split(" ")[0]}.
          </h1>
          <p>
            {membership
              ? `${membership.home.name} is ready for the day.`
              : "Let’s create your first home journal."}
          </p>
        </div>
        <Link
          className="button"
          href={membership ? "/assets" : "/onboarding"}
        >
          <Plus size={16} />
          {membership ? "Add something" : "Start setup"}
        </Link>
      </div>

      {membership ? (
        <CalmStatus health={health} />
      ) : (
        <div className="dash-status">
          <span className="status-orb">
            <ShieldCheck size={25} />
          </span>
          <div>
            <h2>Your home journal is ready to begin</h2>
            <p>Add a home to start tracking equipment, maintenance, and files.</p>
          </div>
          <span>Home health · Not configured</span>
        </div>
      )}

      <div className="dash-grid">
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>Coming up</h2>
            <Link href="/maintenance">View calendar</Link>
          </div>
          {upcoming.length ? (
            upcoming.map((task) => {
              const overdue = task.nextDueAt.getTime() < now.getTime();
              return (
                <div className="dash-task" key={task.id}>
                  <span>
                    <Wrench size={16} />
                  </span>
                  <div>
                    <strong>{task.title}</strong>
                    <small>
                      {overdue ? "overdue · " : ""}
                      {task.priority.toLowerCase()} priority
                    </small>
                  </div>
                  <time>
                    {new Intl.DateTimeFormat("en", {
                      month: "short",
                      day: "numeric",
                      timeZone,
                    }).format(task.nextDueAt)}
                  </time>
                </div>
              );
            })
          ) : (
            <div className="dash-task">
              <span>
                <CalendarDays size={16} />
              </span>
              <div>
                <strong>No maintenance scheduled</strong>
                <small>Your schedule is clear.</small>
              </div>
            </div>
          )}
        </section>

        <section className="dash-card">
          <div className="dash-card-head">
            <h2>At a glance</h2>
            <Link href="/assets">Open home</Link>
          </div>
          <div className="summary-grid">
            <div className="summary-cell">
              <Package size={16} />
              <strong>{metrics.assets}</strong>
              <span>Assets</span>
            </div>
            <div className="summary-cell">
              <CalendarDays size={16} />
              <strong>{metrics.tasks}</strong>
              <span>Tasks</span>
            </div>
            <div className="summary-cell">
              <FileText size={16} />
              <strong>{metrics.documents}</strong>
              <span>Documents</span>
            </div>
            <div className="summary-cell">
              <ShieldCheck size={16} />
              <strong>{metrics.unread}</strong>
              <span>Notices</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
