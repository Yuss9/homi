"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  FileText,
  House,
  LayoutDashboard,
  Package,
  Settings,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { Brand } from "@/src/components/brand";
import { authClient } from "@/src/lib/auth-client";
import type { SelectableHome } from "@/src/features/homes/selection";
import type { ReactNode } from "react";

const navigation = [
  ["/dashboard", "Overview", LayoutDashboard],
  ["/homes", "Homes & rooms", House],
  ["/assets", "Assets", Package],
  ["/maintenance", "Maintenance", CalendarDays],
  ["/repairs", "Repairs", Wrench],
  ["/documents", "Documents", FileText],
  ["/members", "Household", Users],
] as const;

function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof House;
}) {
  const pathname = usePathname();
  const active =
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(`${href}/`));
  return (
    <Link className={active ? "active" : ""} href={href}>
      <Icon size={17} />
      {label}
    </Link>
  );
}

export function AppShell({
  children,
  user,
  homes,
  selectedHomeId,
}: {
  children: ReactNode;
  user: { name: string; email: string };
  homes: SelectableHome[];
  selectedHomeId: string;
}) {
  const pathname = usePathname();
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const selectedHome = homes.find((home) => home.id === selectedHomeId);

  async function selectHome(homeId: string) {
    const response = await fetch("/api/homes/selected", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ homeId }),
    });
    if (response.ok) window.location.reload();
  }

  return (
    <div className="app-body">
      <aside className="app-sidebar">
        <Link href="/dashboard">
          <Brand connected />
        </Link>
        <label className="home-switcher">
          <span>
            <House size={17} />
          </span>
          <span>
            <strong>{selectedHome?.name ?? "No home yet"}</strong>
            <small>{selectedHome?.city || selectedHome?.type || "Personal journal"}</small>
          </span>
          <select
            aria-label="Global selected home"
            value={selectedHomeId}
            disabled={!homes.length}
            onChange={(event) => void selectHome(event.target.value)}
          >
            {homes.map((home) => (
              <option key={home.id} value={home.id}>
                {home.name}
              </option>
            ))}
          </select>
        </label>
        <nav className="app-nav" aria-label="Workspace">
          {navigation.map(([href, label, Icon]) => (
            <NavLink key={href} href={href} label={label} icon={Icon} />
          ))}
        </nav>
        <div className="sidebar-bottom">
          <nav className="app-nav">
            <NavLink href="/settings" label="Settings" icon={Settings} />
          </nav>
          <div className="app-user">
            <span>{initials}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="app-topbar">
          <Link
            className="icon-button"
            href="/notifications"
            aria-label="Notifications"
          >
            <Bell size={19} />
          </Link>
          <button
            className="button button-small"
            onClick={() =>
              void authClient.signOut({
                fetchOptions: {
                  onSuccess: () => window.location.assign("/sign-in"),
                },
              })
            }
          >
            Sign out
          </button>
        </header>
        {children}
      </div>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {[
          ["/dashboard", "Home", LayoutDashboard],
          ["/assets", "Assets", Package],
          ["/maintenance", "Tasks", CalendarDays],
          ["/documents", "Files", FileText],
          ["/settings", "Settings", Settings],
        ].map(([href, label, Icon]) => (
          <Link
            className={pathname === href ? "active" : ""}
            href={href as string}
            key={href as string}
          >
            <Icon size={19} />
            {label as string}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function CalmStatus() {
  return (
    <div className="dash-status">
      <span className="status-orb">
        <ShieldCheck size={25} />
      </span>
      <div>
        <h2>Everything looks good</h2>
        <p>Your home has no critical issues. One task is coming up tomorrow.</p>
      </div>
      <span>Home health · Good</span>
    </div>
  );
}
