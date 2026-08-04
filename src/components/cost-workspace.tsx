"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Coins,
  ExternalLink,
  Hammer,
  LoaderCircle,
  ReceiptText,
  TrendingUp,
  Wrench,
} from "lucide-react";

type Home = { id: string; name: string };
type Total = {
  currency: string;
  maintenance: number;
  repairs: number;
  total: number;
};
type Monthly = {
  month: string;
  currency: string;
  maintenance: number;
  repairs: number;
  total: number;
};
type AssetCost = {
  assetId: string | null;
  assetName: string;
  currency: string;
  total: number;
};
type Entry = {
  id: string;
  type: "MAINTENANCE" | "REPAIR";
  title: string;
  assetId: string | null;
  assetName: string | null;
  date: string;
  cost: number;
  currency: string;
  provider: string | null;
};
type Payload = {
  totals: Total[];
  monthly: Monthly[];
  byAsset: AssetCost[];
  entries: Entry[];
};

function range(period: string) {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  if (period === "year") {
    from.setMonth(0, 1);
    from.setHours(0, 0, 0, 0);
  } else {
    from.setMonth(from.getMonth() - Number(period));
    from.setHours(0, 0, 0, 0);
  }
  return { from, to };
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function CostWorkspace() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [period, setPeriod] = useState("12");
  const [payload, setPayload] = useState<Payload>({
    totals: [],
    monthly: [],
    byAsset: [],
    entries: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/homes")
      .then((response) => response.json())
      .then((result) => {
        const next = result.homes ?? [];
        setHomes(next);
        setHomeId(next[0]?.id ?? "");
      });
  }, []);

  useEffect(() => {
    if (!homeId) return;
    const { from, to } = range(period);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch(
        `/api/costs?homeId=${homeId}&from=${from.toISOString()}&to=${to.toISOString()}`,
        { signal: controller.signal },
      )
        .then((response) => response.json())
        .then((result) =>
          setPayload({
            totals: result.totals ?? [],
            monthly: result.monthly ?? [],
            byAsset: result.byAsset ?? [],
            entries: result.entries ?? [],
          }),
        )
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setPayload({ totals: [], monthly: [], byAsset: [], entries: [] });
        })
        .finally(() => setLoading(false));
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [homeId, period]);

  const maxMonthly = useMemo(
    () => Math.max(...payload.monthly.map((entry) => entry.total), 1),
    [payload.monthly],
  );

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div>
          <small>Household spend</small>
          <h1>Cost insights</h1>
          <p>
            Understand what maintenance and repairs cost, without mixing
            currencies or losing the underlying service history.
          </p>
        </div>
        <div className="inline-actions">
          <select
            aria-label="Cost period"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="year">This year</option>
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
            <option value="24">Last 24 months</option>
          </select>
          <select
            aria-label="Selected home"
            value={homeId}
            onChange={(event) => setHomeId(event.target.value)}
          >
            {homes.map((home) => (
              <option key={home.id} value={home.id}>
                {home.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <p className="loading-line" role="status">
          <LoaderCircle className="button-spinner" size={16} /> Updating costs…
        </p>
      )}

      <section className="cost-summary-grid">
        {payload.totals.map((total) => (
          <article className="summary-cell cost-summary-card" key={total.currency}>
            <span>
              <Coins size={18} /> {total.currency}
            </span>
            <strong>{money(total.total, total.currency)}</strong>
            <small>
              {money(total.maintenance, total.currency)} maintenance ·{" "}
              {money(total.repairs, total.currency)} repairs
            </small>
          </article>
        ))}
        {!payload.totals.length && (
          <article className="dash-card empty-state">
            <ReceiptText size={22} />
            <h2>No recorded costs</h2>
            <p>
              Add a cost when completing maintenance or editing a repair to
              build this view.
            </p>
          </article>
        )}
      </section>

      <div className="cost-layout">
        <section className="dash-card cost-chart-card">
          <div className="dash-card-head">
            <div>
              <small>Monthly pattern</small>
              <h2>Spend over time</h2>
            </div>
            <TrendingUp size={18} />
          </div>
          <div className="cost-bars" aria-label="Monthly household costs">
            {payload.monthly.map((entry) => (
              <div className="cost-bar-row" key={`${entry.month}-${entry.currency}`}>
                <span>
                  {new Intl.DateTimeFormat("en", {
                    month: "short",
                    year: "2-digit",
                  }).format(new Date(`${entry.month}-01T12:00:00`))}
                </span>
                <div>
                  <i
                    style={{
                      width: `${Math.max((entry.total / maxMonthly) * 100, 2)}%`,
                    }}
                  />
                </div>
                <strong>{money(entry.total, entry.currency)}</strong>
              </div>
            ))}
          </div>
          {!payload.monthly.length && (
            <p className="muted-copy">Monthly totals will appear here.</p>
          )}
        </section>

        <section className="dash-card">
          <div className="dash-card-head">
            <div>
              <small>Where money goes</small>
              <h2>Highest-cost assets</h2>
            </div>
            <Hammer size={18} />
          </div>
          {payload.byAsset.map((asset, index) => (
            <div className="cost-asset-row" key={`${asset.assetId}-${asset.currency}`}>
              <span>{index + 1}</span>
              <div>
                <strong>{asset.assetName}</strong>
                <small>{asset.currency}</small>
              </div>
              <b>{money(asset.total, asset.currency)}</b>
              {asset.assetId && (
                <Link
                  href={`/assets/${asset.assetId}`}
                  aria-label={`Open ${asset.assetName}`}
                >
                  <ExternalLink size={15} />
                </Link>
              )}
            </div>
          ))}
          {!payload.byAsset.length && (
            <p className="muted-copy">No asset costs in this period.</p>
          )}
        </section>
      </div>

      <section className="dash-card resource-list-card">
        <div className="dash-card-head">
          <div>
            <small>{payload.entries.length} transactions</small>
            <h2>Cost ledger</h2>
          </div>
          <ReceiptText size={18} />
        </div>
        {payload.entries.map((entry) => {
          const Icon = entry.type === "MAINTENANCE" ? Wrench : Hammer;
          return (
            <article
              className="dash-task cost-entry"
              key={`${entry.type}-${entry.id}`}
            >
              <span>
                <Icon size={16} />
              </span>
              <div>
                <strong>{entry.title}</strong>
                <small>
                  {[entry.assetName, entry.provider, entry.type.toLowerCase()]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </div>
              <time>
                {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                  new Date(entry.date),
                )}
              </time>
              <b>{money(entry.cost, entry.currency)}</b>
            </article>
          );
        })}
      </section>
    </main>
  );
}
