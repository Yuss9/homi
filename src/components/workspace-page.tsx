import { ArrowRight, type LucideIcon } from "lucide-react";

export function WorkspacePage({
  title,
  description,
  action,
  icon: Icon,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  description: string;
  action: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <main id="main" className="app-main">
      <div className="dashboard-head"><div><small>Your home journal</small><h1>{title}</h1><p>{description}</p></div><button className="button">{action}<ArrowRight size={16} /></button></div>
      <div className="empty-state" style={{ marginTop: 32 }}><div><span><Icon size={24} /></span><h2>{emptyTitle}</h2><p>{emptyDescription}</p><button className="button button-small">{action}</button></div></div>
      <p style={{ marginTop: 18, color: "var(--muted)", fontSize: 11 }}>Use the action above to add your first item. Saved records are private and scoped to this home.</p>
    </main>
  );
}
