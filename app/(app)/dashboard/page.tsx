import Link from "next/link";
import { cookies } from "next/headers";
import { and, count, eq, isNull, or } from "drizzle-orm";
import {
  ArrowRight,
  CalendarDays,
  Coins,
  FileText,
  Package,
  Plus,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { db } from "@/db";
import { homeMembers, homes, notifications } from "@/db/schema";
import { CalmStatus } from "@/src/components/app-shell";
import { getDictionary } from "@/src/features/i18n/dictionaries";
import {
  resolveSelectedHomeId,
  selectedHomeCookie,
} from "@/src/features/homes/selection";
import { requireVerifiedPageUser } from "@/src/server/authorization/page";
import { getConnectedHomeSummary } from "@/src/server/integrations/home-summary";
import { getExperiencePreferences } from "@/src/server/services/experience";

export const metadata = { title: "Dashboard" };

const localeTags = { en: "en-US", fr: "fr-FR", de: "de-DE" } as const;

export default async function DashboardPage() {
  const session = await requireVerifiedPageUser();
  const [memberships, experience] = await Promise.all([
    db
      .select({ home: homes })
      .from(homeMembers)
      .innerJoin(homes, eq(homes.id, homeMembers.homeId))
      .where(
        and(
          eq(homeMembers.userId, session.user.id),
          isNull(homes.archivedAt),
        ),
      ),
    getExperiencePreferences(session.user.id),
  ]);
  const selectedHomeId = resolveSelectedHomeId(
    memberships.map(({ home }) => home),
    (await cookies()).get(selectedHomeCookie)?.value,
  );
  const membership = memberships.find(({ home }) => home.id === selectedHomeId);
  const dictionary = getDictionary(experience.locale);
  const locale = localeTags[experience.locale];
  const now = new Date();
  const timeZone = membership?.home.timezone ?? "UTC";
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone,
    }).format(now),
  );
  const greeting =
    hour < 12
      ? dictionary.goodMorning
      : hour < 18
        ? dictionary.goodAfternoon
        : dictionary.goodEvening;
  const dateLabel = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeZone,
  }).format(now);

  const summary = membership
    ? await getConnectedHomeSummary(membership.home.id)
    : null;
  const unread = membership
    ? (
        await db
          .select({ value: count() })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, session.user.id),
              or(
                eq(notifications.homeId, membership.home.id),
                isNull(notifications.homeId),
              ),
              isNull(notifications.readAt),
              isNull(notifications.dismissedAt),
            ),
          )
      )[0]?.value ?? 0
    : 0;

  const widgets = summary
    ? {
        health: <CalmStatus key="health" health={summary.health} />,
        upcoming: (
          <section className="dash-card" key="upcoming">
            <div className="dash-card-head">
              <h2>Coming up</h2>
              <Link href="/calendar">{dictionary.calendar}</Link>
            </div>
            {summary.upcomingMaintenance.length ? (
              summary.upcomingMaintenance.slice(0, 3).map((task) => {
                const due = new Date(task.nextDueAt);
                const overdue = due < now;
                return (
                  <Link className="dash-task" href={task.url} key={task.id}>
                    <span><Wrench size={16} /></span>
                    <div>
                      <strong>{task.title}</strong>
                      <small>
                        {overdue ? "overdue · " : ""}
                        {task.priority.toLowerCase()} priority
                      </small>
                    </div>
                    <time>
                      {new Intl.DateTimeFormat(locale, {
                        month: "short",
                        day: "numeric",
                        timeZone,
                      }).format(due)}
                    </time>
                  </Link>
                );
              })
            ) : (
              <div className="dash-task">
                <span><CalendarDays size={16} /></span>
                <div><strong>No maintenance scheduled</strong><small>Your schedule is clear.</small></div>
              </div>
            )}
          </section>
        ),
        summary: (
          <section className="dash-card" key="summary">
            <div className="dash-card-head"><h2>At a glance</h2><Link href="/assets">{dictionary.assets}</Link></div>
            <div className="summary-grid">
              <div className="summary-cell"><Package size={16} /><strong>{summary.metrics.assets}</strong><span>{dictionary.assets}</span></div>
              <div className="summary-cell"><CalendarDays size={16} /><strong>{summary.metrics.maintenanceTasks}</strong><span>{dictionary.tasks}</span></div>
              <div className="summary-cell"><FileText size={16} /><strong>{summary.metrics.documents}</strong><span>{dictionary.documents}</span></div>
              <div className="summary-cell"><ShieldCheck size={16} /><strong>{unread}</strong><span>{dictionary.notifications}</span></div>
            </div>
          </section>
        ),
        repairs: (
          <section className="dash-card" key="repairs">
            <div className="dash-card-head"><h2>{dictionary.repairs}</h2><Link href="/repairs">Open</Link></div>
            {summary.openRepairItems.length ? summary.openRepairItems.slice(0, 3).map((repair) => (
              <Link className="dash-task" href={repair.url} key={repair.id}>
                <span><TriangleAlert size={16} /></span>
                <div><strong>{repair.title}</strong><small>{repair.status.toLowerCase().replaceAll("_", " ")}</small></div>
                <time>{repair.issueDate}</time>
              </Link>
            )) : <p className="muted-copy">No open repairs.</p>}
          </section>
        ),
        costs: (
          <section className="dash-card dashboard-cost-card" key="costs">
            <div className="dash-card-head"><h2>{dictionary.costs}</h2><Coins size={17} /></div>
            <strong>{new Intl.NumberFormat(locale, { style: "currency", currency: summary.home.currency }).format(summary.metrics.monthlyCosts)}</strong>
            <p>Maintenance and repairs recorded this month.</p>
            <Link className="button button-secondary" href="/costs">Open cost insights</Link>
          </section>
        ),
      }
    : null;

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head" data-reveal>
        <div>
          <small>{dateLabel}</small>
          <h1>{greeting}, {session.user.name.split(" ")[0]}.</h1>
          <p>
            {membership
              ? `${membership.home.name} ${dictionary.homeReady}`
              : dictionary.startJournal}
          </p>
        </div>
        <Link className="button" href={membership ? "/assets" : "/onboarding"}>
          <Plus size={16} />
          {membership ? "Add something" : "Start setup"}
        </Link>
      </div>

      {membership ? (
        <section className="dashboard-atmosphere" data-reveal aria-label="Home care overview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.pexels.com/photos/7512985/pexels-photo-7512985.jpeg?auto=compress&cs=tinysrgb&w=1800"
            alt="Everyday care in a bright contemporary kitchen"
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
          />
          <div className="dashboard-atmosphere-copy">
            <small>Today at {membership.home.name}</small>
            <h2>{summary?.health.title ?? "A clear place for everything your home needs."}</h2>
            <p>
              {summary?.health.summary ??
                "Add equipment, routines and documents once, then let Homi keep the household memory close."}
            </p>
            <Link className="button button-light button-small" href="/maintenance">
              Open maintenance <ArrowRight size={15} />
            </Link>
          </div>
          <div className="dashboard-atmosphere-badge">
            <Sparkles size={14} /> {summary ? `${summary.health.score}/100 home health` : "Ready to begin"}
          </div>
        </section>
      ) : null}

      {summary && widgets ? (
        <div className="personalized-dashboard">
          {experience.dashboardWidgets.map((widget) => widgets[widget])}
        </div>
      ) : (
        <div className="dash-status">
          <span className="status-orb"><ShieldCheck size={25} /></span>
          <div><h2>Your home journal is ready to begin</h2><p>Add a home to start tracking equipment, maintenance, and files.</p></div>
          <span>Home health · Not configured</span>
        </div>
      )}
    </main>
  );
}
