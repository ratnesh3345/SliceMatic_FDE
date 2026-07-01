"use client";
// app/admin/analytics/page.js — Owner cockpit. North-star: Contribution Margin.
// Reads analytics_orders + v_item_sales + v_topping_sales + cost_model from Supabase.
// Setup: run analytics_setup.sql AND analytics_addon.sql, then `npm install recharts`.
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(url || "http://localhost", key || "anon");

const BRAND = "#E11D74", INK = "#1A1614", REV = "#6E5563", GOOD = "#2F7A4D", WARN = "#C77700",
      BAD = "#b91c1c", MUTED = "#8A7E73", LINE = "#E7DDD2", PAPER = "#FBF6EF";
const PLAN = { cm: 511, margin: 60.3, payback: 18 };

const INR = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const h12 = (h) => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;
const dfmt = (s) => new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function Card({ children, style }) {
  return <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16,
    boxShadow: "0 1px 2px rgba(26,22,20,.04), 0 8px 24px rgba(26,22,20,.05)", padding: 16, ...style }}>{children}</div>;
}
function Chip({ tone, children }) {
  const c = tone === "good" ? { bg: "#e7f3ec", fg: GOOD } : tone === "warn" ? { bg: "#fdeee0", fg: WARN }
    : tone === "bad" ? { bg: "#fbe9e9", fg: BAD } : { bg: "#f2ece4", fg: MUTED };
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: c.bg, color: c.fg, whiteSpace: "nowrap" }}>{children}</span>;
}
function Metric({ label, value, def, chip, big }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, minHeight: 16 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: MUTED, fontWeight: 700 }}>{label}</span>
        {chip}
      </div>
      <div style={{ fontSize: big ? 32 : 21, fontWeight: 800, color: big ? BRAND : INK, lineHeight: 1.05 }}>{value}</div>
      {def && <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.4 }}>{def}</div>}
    </Card>
  );
}
const Section = ({ n, title, hint }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "22px 0 10px" }}>
    <span style={{ fontSize: 14, fontWeight: 800, color: INK }}>{n}. {title}</span>
    {hint && <span style={{ fontSize: 12.5, color: MUTED }}>— {hint}</span>}
  </div>
);
const Dot = ({ color }) => <span style={{ width: 9, height: 9, borderRadius: 999, background: color, display: "inline-block" }} />;
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, alignItems: "stretch" };

function Rank({ title, data, hint }) {
  if (!data?.length) return null;
  const max = data[0].qty;
  return (
    <Card>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {data.map((t, i) => {
        const last = i === data.length - 1;
        return (
          <div key={t.name} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span>{i + 1}. {t.name} {i === 0 && <Chip tone="good">bestseller</Chip>} {last && data.length > 2 && <Chip tone="warn">slowest</Chip>}</span>
              <span style={{ color: MUTED }}>{t.qty}</span>
            </div>
            <div style={{ height: 8, background: "#f2e9df", borderRadius: 6, marginTop: 3 }}>
              <div style={{ width: `${(t.qty / max) * 100}%`, height: "100%", background: last ? "#d9b3c6" : BRAND, borderRadius: 6 }} />
            </div>
          </div>
        );
      })}
      {hint && <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>{hint}</div>}
    </Card>
  );
}

export default function AnalyticsPage() {
  const [rows, setRows] = useState([]);
  const [pizzas, setPizzas] = useState([]);
  const [toppings, setToppings] = useState([]);
  const [cost, setCost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [period, setPeriod] = useState(30);      // 7 | 30 | "all"
  const [selHour, setSelHour] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [a, b, c, d] = await Promise.all([
          supabase.from("analytics_orders").select("*"),
          supabase.from("v_item_sales").select("*"),
          supabase.from("v_topping_sales").select("*"),
          supabase.from("cost_model").select("*").maybeSingle(),
        ]);
        if (a.error) throw a.error;
        setRows(a.data || []); setPizzas(b.data || []); setToppings(c.data || []); setCost(d.data || null);
      } catch (e) { setErr(e.message || "Could not load analytics."); }
      finally { setLoading(false); }
    })();
  }, []);

  const m = useMemo(() => {
    if (!rows.length) return null;
    const allDates = rows.map((r) => r.order_date).sort();
    const maxDate = allDates[allDates.length - 1];
    let from = allDates[0];
    if (period !== "all") {
      const cut = new Date(maxDate + "T00:00:00"); cut.setDate(cut.getDate() - (period - 1));
      from = cut.toISOString().slice(0, 10);
    }
    const R = rows.filter((r) => r.order_date >= from);
    if (!R.length) return { empty: true, from, maxDate };

    const n = R.length;
    const netRev = R.reduce((s, r) => s + Number(r.net_revenue), 0);
    const cm = R.reduce((s, r) => s + Number(r.contribution_margin), 0);
    const cogs = R.reduce((s, r) => s + Number(r.cogs), 0);
    const gross = R.reduce((s, r) => s + Number(r.total), 0);
    const byDay = {}, byHour = {}, phones = {};
    for (const r of R) {
      byDay[r.order_date] = byDay[r.order_date] || { date: r.order_date, rev: 0, cm: 0 };
      byDay[r.order_date].rev += Number(r.net_revenue); byDay[r.order_date].cm += Number(r.contribution_margin);
      byHour[r.order_hour] = byHour[r.order_hour] || { orders: 0, rev: 0 };
      byHour[r.order_hour].orders += 1; byHour[r.order_hour].rev += Number(r.total);
      phones[r.phone] = (phones[r.phone] || 0) + 1;
    }
    const days = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ ...d, label: dfmt(d.date) }));
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${h}`, orders: byHour[h]?.orders || 0, rev: byHour[h]?.rev || 0 })).filter((h) => h.orders > 0);
    const peak = hours.reduce((a, b) => (b.orders > a.orders ? b : a), hours[0]);
    const repeat = Object.values(phones).filter((c) => c > 1).length / Object.keys(phones).length * 100;
    const cmPerOrder = cm / n, nDays = days.length, avgOrdersDay = n / nDays;
    const fixed = Number(cost?.monthly_fixed_cost || 203000), capital = Number(cost?.capital_outlay || 1500000);
    const monthlyCM = cm / nDays * 30, monthlyProfit = monthlyCM - fixed;
    const breakEvenDay = fixed / cmPerOrder / 30;
    const paybackMonths = monthlyProfit > 0 ? capital / monthlyProfit : null;
    return { n, netRev, cm, cogs, gross, cmPerOrder, marginPct: cm / netRev * 100, cogsPct: cogs / netRev * 100,
      aov: gross / n, repeat, avgOrdersDay, nDays, days, hours, peak, fixed, capital, monthlyCM, monthlyProfit,
      breakEvenDay, paybackMonths, from, maxDate,
      liveCount: R.filter((r) => r.is_sample === false).length };
  }, [rows, cost, period]);

  if (loading) return <Wrap><p style={{ color: MUTED }}>Loading analytics…</p></Wrap>;
  if (err) return <Wrap><Card><b>Couldn't load analytics.</b><div style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>{err}</div>
    <div style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>Run <code>analytics_setup.sql</code> + <code>analytics_addon.sql</code>, and check env keys.</div></Card></Wrap>;
  if (!m || m.empty) return <Wrap active="analytics"><PeriodBar period={period} setPeriod={setPeriod} /><p style={{ color: MUTED, marginTop: 12 }}>No orders in this period.</p></Wrap>;

  const cmGood = m.cmPerOrder >= PLAN.cm * 0.92, beGood = m.avgOrdersDay >= m.breakEvenDay;
  const effHour = selHour ?? m.peak.hour;
  const hd = m.hours.find((h) => h.hour === effHour) || m.peak;
  const pizzaRank = pizzas.map((p) => ({ name: p.pizza, qty: Number(p.qty_sold) }));
  const topRank = topRankList(toppings);

  return (
    <Wrap active="analytics">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Owner cockpit</h1>
          <p style={{ color: MUTED, fontSize: 13, margin: "4px 0 0" }}>
            Showing <b style={{ color: INK }}>{dfmt(m.from)} – {dfmt(m.maxDate)}</b> ({m.nDays} days) · {m.n} orders
          </p>
        </div>
        <PeriodBar period={period} setPeriod={setPeriod} />
      </div>
      <p style={{ color: MUTED, fontSize: 13, marginTop: 10, maxWidth: 720 }}>
        The one question: <b style={{ color: INK }}>are we making money, and beating the plan?</b> Headline = <b style={{ color: BRAND }}>contribution margin</b>; everything else explains it.
      </p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11.5, color: MUTED, marginTop: 8 }}>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}><Dot color={BRAND} /> Headline</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}><Dot color={GOOD} /> Ahead of plan</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}><Dot color={WARN} /> Watch</span>
      </div>

      {/* 1 — Profitability */}
      <Section n="1" title="Profitability" hint="the one number that matters most" />
      <Card style={{ background: "linear-gradient(180deg,#fff,#fdeef5)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          <div style={{ borderRight: `1px solid ${LINE}`, paddingRight: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: BRAND, fontWeight: 700 }}>Contribution / order</span>
              <Chip tone={cmGood ? "good" : "warn"}>plan {INR(PLAN.cm)} {cmGood ? "✓" : "•"}</Chip>
            </div>
            <div style={{ fontSize: 38, fontWeight: 800, color: BRAND, lineHeight: 1.05 }}>{INR(m.cmPerOrder)}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Profit left per order after variable cost. = net revenue − variable cost.</div>
          </div>
          <div style={{ borderRight: `1px solid ${LINE}`, paddingRight: 16 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: MUTED, fontWeight: 700 }}>Margin %</div>
            <div style={{ fontSize: 32, fontWeight: 800 }}>{m.marginPct.toFixed(0)}%</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Contribution as a share of net revenue. Plan: {PLAN.margin}%.</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: MUTED, fontWeight: 700 }}>Total contribution</div>
            <div style={{ fontSize: 32, fontWeight: 800 }}>{INR(m.cm)}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Summed margin across all {m.n} orders in this period.</div>
          </div>
        </div>
      </Card>

      {/* 2 — Vs plan */}
      <Section n="2" title="Are we beating the plan?" hint="volume & profit vs the business case" />
      <div style={grid}>
        <Metric label="Break-even" value={`${m.breakEvenDay.toFixed(0)}/day`} def={`Orders/day to cover ${INR(m.fixed)} monthly fixed cost.`} />
        <Metric label="Actual volume" value={`${m.avgOrdersDay.toFixed(0)}/day`} chip={<Chip tone={beGood ? "good" : "bad"}>{beGood ? `+${(m.avgOrdersDay - m.breakEvenDay).toFixed(0)} over` : "below"}</Chip>} def="Average orders per day this period." />
        <Metric label="Monthly profit" value={INR(m.monthlyProfit)} chip={<Chip tone={m.monthlyProfit >= 0 ? "good" : "bad"}>{m.monthlyProfit >= 0 ? "profitable" : "loss"}</Chip>} def="Monthly contribution minus fixed costs — the bottom line." />
        <Metric label="Capital payback" value={m.paybackMonths ? `${m.paybackMonths.toFixed(0)} mo` : "—"} chip={m.paybackMonths ? <Chip tone={m.paybackMonths <= PLAN.payback + 3 ? "good" : "warn"}>plan ~{PLAN.payback}mo</Chip> : null} def={`Months to recover the ${INR(m.capital)} setup cost.`} />
      </div>

      {/* 3 — Drivers */}
      <Section n="3" title="What drives the margin" hint="the levers" />
      <div style={grid}>
        <Metric label="Net revenue" value={INR(m.netRev)} def="Money kept by the business (excludes GST, passed to govt)." />
        <Metric label="Avg order value" value={INR(m.aov)} def="Average spend per order incl. GST. Bigger baskets → more margin." />
        <Metric label="Ingredient cost" value={`${m.cogsPct.toFixed(0)}%`} def="COGS as a share of net revenue. If it climbs, margin falls." />
        <Metric label="Repeat customers" value={`${m.repeat.toFixed(0)}%`} chip={<Chip tone="good">retention</Chip>} def="Share who ordered more than once — the cheapest growth." />
      </div>

      {/* Trend */}
      <Card style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Daily net revenue vs contribution margin</div>
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: MUTED }}>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}><Dot color={REV} /> Net revenue</span>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}><Dot color={BRAND} /> Contribution</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={m.days} margin={{ left: -8, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={REV} stopOpacity={0.18} /><stop offset="100%" stopColor={REV} stopOpacity={0} /></linearGradient>
              <linearGradient id="gCm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BRAND} stopOpacity={0.28} /><stop offset="100%" stopColor={BRAND} stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#efe6da" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: MUTED }} interval={Math.ceil(m.days.length / 7)} />
            <YAxis tick={{ fontSize: 11, fill: MUTED }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v, k) => [INR(v), k === "rev" ? "Net revenue" : "Contribution"]} />
            <Area type="monotone" dataKey="rev" stroke={REV} strokeWidth={2} fill="url(#gRev)" />
            <Area type="monotone" dataKey="cm" stroke={BRAND} strokeWidth={2.5} fill="url(#gCm)" />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>The shaded gap between the lines is your daily variable cost — a steady gap means consistent margins.</div>
      </Card>

      {/* Interactive hours */}
      <Card style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Orders by hour <span style={{ fontWeight: 400, color: MUTED }}>— tap a bar to inspect</span></div>
          <div style={{ fontSize: 12, color: MUTED, display: "flex", gap: 6, alignItems: "center" }}><Dot color={BRAND} /> selected hour</div>
        </div>
        <div style={{ background: "#fdeef5", border: `1px solid ${LINE}`, borderRadius: 12, padding: "10px 14px", margin: "8px 0 4px" }}>
          <b style={{ color: BRAND }}>{h12(hd.hour)}</b>{effHour === m.peak.hour ? " (your peak)" : ""} — <b>{hd.orders}</b> orders · <b>{INR(hd.rev)}</b> revenue · {INR(hd.rev / hd.orders)}/order
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={m.hours} margin={{ left: -22, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#efe6da" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: MUTED }} />
            <YAxis tick={{ fontSize: 11, fill: MUTED }} />
            <Tooltip formatter={(v) => [`${v} orders`, "Orders"]} labelFormatter={(l) => h12(Number(l))} cursor={{ fill: "rgba(225,29,116,.06)" }} />
            <Bar dataKey="orders" radius={[4, 4, 0, 0]} onClick={(d) => setSelHour(d.hour)} style={{ cursor: "pointer" }}>
              {m.hours.map((h) => <Cell key={h.hour} fill={h.hour === effHour ? BRAND : "#f4a9cd"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Roster both riders and pre-prep for the dinner rush around <b style={{ color: INK }}>{h12(m.peak.hour)}</b>.</div>
      </Card>

      {/* Menu performance */}
      <Section n="4" title="Menu performance" hint="what to promote, what to cut" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Rank title="Pizzas — best to slowest" data={pizzaRank}
          hint={pizzaRank.length ? `Feature ${pizzaRank[0].name}; review ${pizzaRank[pizzaRank.length - 1].name} (slow mover).` : ""} />
        <Rank title="Toppings — best to slowest" data={topRank}
          hint={topRank.length ? `${topRank[0].name} is the favourite; ${topRank[topRank.length - 1].name} barely sells.` : ""} />
      </div>

      <p style={{ fontSize: 11, color: MUTED, marginTop: 16 }}>
        Live from the <code>analytics_orders</code> view — {m.liveCount} live + {m.n - m.liveCount} seed orders modelled on the SliceMatic P&amp;L.
        Cost assumptions live in the editable <code>cost_model</code> table.
      </p>
    </Wrap>
  );
}

function topRankList(toppings) {
  const arr = (toppings || []).map((t) => ({ name: t.topping, qty: Number(t.qty_sold) })).sort((a, b) => b.qty - a.qty);
  if (arr.length <= 6) return arr;
  return [...arr.slice(0, 4), arr[arr.length - 1]]; // top 4 + the slowest
}

function PeriodBar({ period, setPeriod }) {
  const opt = (v, label) => (
    <button key={label} onClick={() => setPeriod(v)} style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, border: "none", cursor: "pointer",
      color: period === v ? "#fff" : MUTED, background: period === v ? INK : "transparent" }}>{label}</button>
  );
  return <div style={{ display: "flex", gap: 2, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 999, padding: 3 }}>
    {opt(7, "7 days")}{opt(30, "30 days")}{opt("all", "All")}</div>;
}

function Wrap({ children, active }) {
  const tab = (href, label, isActive) => (
    <a href={href} style={{ fontSize: 13, fontWeight: 600, textDecoration: "none", padding: "6px 12px", borderRadius: 999, color: isActive ? "#fff" : MUTED, background: isActive ? BRAND : "transparent" }}>{label}</a>
  );
  return (
    <main style={{ minHeight: "100vh", background: PAPER }}>
      <header style={{ borderBottom: `1px solid ${LINE}`, background: "rgba(251,246,239,.7)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "0 20px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "Bricolage Grotesque, system-ui", fontWeight: 800, fontSize: 22, color: BRAND }}>SliceMatic</span>
          <nav style={{ display: "flex", gap: 4, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 999, padding: 3 }}>
            {tab("/admin", "Orders", active === "orders")}{tab("/admin/analytics", "Analytics", active === "analytics")}
          </nav>
        </div>
      </header>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "22px 20px" }}>{children}</div>
    </main>
  );
}