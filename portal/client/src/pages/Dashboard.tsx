import { CalendarDays, Check, ChevronRight, CircleAlert, ListChecks, Plus, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorNote, Loading } from "../components/ui";
import { fmtShort, plural, todayIso } from "../format";
import { useLoad } from "../hooks";
import { money } from "../modules";
import { AdminClient, MasterPost, MasterTask, STAGES, STATUS_LABEL, stageOf } from "../types";
import { monthGrid } from "./Calendar";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["M", "T", "W", "T", "F", "S", "S"];

const greeting = (h: number) => (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

function MiniCalendar({ posts }: { posts: MasterPost[] }) {
  const nav = useNavigate();
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const cells = monthGrid(cursor.y, cursor.m);
  const busy = useMemo(() => new Set(posts.map((p) => p.publishDate)), [posts]);
  const today = todayIso();
  const shift = (d: number) => {
    const n = new Date(cursor.y, cursor.m + d, 1);
    setCursor({ y: n.getFullYear(), m: n.getMonth() });
  };
  return (
    <>
      <header>
        <h2>
          {MONTHS[cursor.m]} {cursor.y}
        </h2>
        <span style={{ display: "flex", gap: ".25rem" }}>
          <button className="pill" onClick={() => shift(-1)} aria-label="Previous month">
            ‹
          </button>
          <button className="pill" onClick={() => shift(1)} aria-label="Next month">
            ›
          </button>
        </span>
      </header>
      <div className="mini-cal" role="grid" aria-label="Month overview">
        {DOW.map((d, i) => (
          <span key={i} className="dow" aria-hidden="true">
            {d}
          </span>
        ))}
        {cells.map((iso, i) =>
          iso ? (
            <button
              key={iso}
              className={`${iso === today ? "today" : ""} ${busy.has(iso) ? "has" : ""}`}
              onClick={() => nav("/admin/calendar")}
              aria-label={`${fmtShort(iso)}${busy.has(iso) ? ", has posts" : ""}`}
            >
              {Number(iso.slice(8))}
            </button>
          ) : (
            <span key={`b${i}`} />
          ),
        )}
      </div>
    </>
  );
}

type Tracker = {
  invoicedThisMonth: number; invoicedCount: number; outstanding: number; outstandingCount: number; overdue: number; overdueCount: number;
  paidThisMonth: number; paidCount: number; dueSoon: number; dueSoonCount: number; draftCount: number; total: number;
  watch: { id: string; title: string; number: string | null; clientName: string | null; amount: number; date: string | null; daysLate: number; late: boolean; to: string }[];
};

function dueLabel(date: string | null, today: string) {
  if (!date) return "No date";
  if (date < today) return `Overdue · ${fmtShort(date)}`;
  if (date === today) return "Today";
  return fmtShort(date);
}

function MoneyTracker({ data, onChanged }: { data: Tracker; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const markPaid = async (id: string) => {
    setBusy(id);
    setErr(null);
    try {
      await api.patch(`/api/admin/records/finance/${id}`, { status: "PAID", data: { paidDate: todayIso() } });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't mark that as paid");
    } finally {
      setBusy(null);
    }
  };
  const figures = [
    { label: "Invoiced this month", value: data.invoicedThisMonth, note: `${data.invoicedCount} ${plural(data.invoicedCount, "invoice", "invoices")}` },
    { label: "Received this month", value: data.paidThisMonth, note: `${data.paidCount} paid`, tone: "ok" },
    { label: "Outstanding", value: data.outstanding, note: `${data.outstandingCount} unpaid${data.dueSoonCount ? `, ${data.dueSoonCount} due this week` : ""}` },
    { label: "Overdue", value: data.overdue, note: data.overdueCount ? `${data.overdueCount} to chase` : "Nothing late", tone: data.overdueCount ? "bad" : "" },
  ];
  const today = todayIso();
  return (
    <>
      <header>
        <h2 id="h-money">Invoices and payments</h2>
        <Link className="pill" to="/admin/finance">
          Finance
        </Link>
      </header>
      {data.total === 0 ? (
        <p className="muted">
          No invoices tracked yet. <Link className="text-link" to="/admin/finance?new=1">Add the first one</Link> to see what's owed and what's been paid.
        </p>
      ) : (
        <>
          <dl className="money-figs">
            {figures.map((f) => (
              <div key={f.label} className={f.tone ? `m-${f.tone}` : ""}>
                <dt>{f.label}</dt>
                <dd>{money(f.value)}</dd>
                <span className="muted small">{f.note}</span>
              </div>
            ))}
          </dl>
          {data.watch.length === 0 ? (
            <p className="muted small">No unpaid invoices with a due date.</p>
          ) : (
            <ul className="rows money-watch" aria-label="Invoices to follow up">
              {data.watch.map((w) => (
                <li key={w.id}>
                  <Link to={w.to}>
                    <span className="rows-main">
                      <strong>{w.clientName?.replace(/\s*\(demo\)/i, "") ?? w.title}</strong>
                      <span className="muted small">
                        {[w.number, w.clientName ? w.title : null].filter(Boolean).join(" · ") || "Invoice"}
                      </span>
                    </span>
                    <span className="money-amt">
                      <b>{money(w.amount)}</b>
                      <span className={w.late ? "late small" : "muted small"}>{dueLabel(w.date, today)}</span>
                    </span>
                  </Link>
                  <button type="button" className="pill pay-btn" disabled={busy === w.id} onClick={() => markPaid(w.id)} aria-label={`Mark ${w.title} as paid`}>
                    <Check size={14} aria-hidden="true" /> Paid
                  </button>
                </li>
              ))}
            </ul>
          )}
          {data.draftCount ? (
            <p className="muted small" style={{ marginTop: ".6rem" }}>
              {data.draftCount} draft {plural(data.draftCount, "invoice", "invoices")} not sent yet.
            </p>
          ) : null}
        </>
      )}
      <ErrorNote message={err} />
    </>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const clients = useLoad<AdminClient[]>("/api/admin/clients");
  const posts = useLoad<MasterPost[]>("/api/admin/posts");
  const tasks = useLoad<MasterTask[]>("/api/admin/tasks");
  const tracker = useLoad<Tracker>("/api/admin/records/finance/tracker");
  const recAttention = useLoad<{ overdue: { label: string; title: string; clientName: string | null; to: string }[] }>("/api/admin/records/attention");
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [tickError, setTickError] = useState<string | null>(null);

  if (clients.loading || posts.loading || tasks.loading) return <Loading />;
  if (!clients.data || !posts.data || !tasks.data) return <ErrorNote message={clients.error ?? posts.error ?? tasks.error} />;

  const now = new Date();
  const today = todayIso();
  const active = clients.data.filter((c) => c.status === "ACTIVE");
  const firstName = user?.name.split(" ")[0] ?? "";
  const open = tasks.data.filter((t) => !t.done && !ticked.has(t.id));
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
  const nextTasks = [...open].sort((a, b) => (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") || a.title.localeCompare(b.title));
  const upcoming = posts.data.filter((p) => p.publishDate >= today && stageOf(p.status) !== "PUBLISHED" && stageOf(p.status) !== "ARCHIVED").slice(0, 5);
  const awaiting = posts.data.filter((p) => stageOf(p.status) === "INTERNAL_REVIEW");
  const drafts = posts.data.filter((p) => stageOf(p.status) === "IDEA");

  const statusCounts = STAGES.map((s) => ({
    label: STATUS_LABEL[s],
    n: posts.data!.filter((p) => stageOf(p.status) === s).length,
  }));
  const maxCount = Math.max(1, ...statusCounts.map((s) => s.n));

  const tick = async (t: MasterTask) => {
    setTickError(null);
    try {
      await api.patch(`/api/c/${t.clientSlug}/tasks/${t.id}`, { done: true });
      setTicked(new Set(ticked).add(t.id));
    } catch (e) {
      setTickError(e instanceof Error ? e.message : "Couldn't update that to-do");
    }
  };

  const attention: { key: string; text: string; to: string }[] = [];
  for (const o of recAttention.data?.overdue.slice(0, 5) ?? []) attention.push({ key: "r" + o.to, text: `${o.title}: ${o.label}${o.clientName ? ` (${o.clientName})` : ""}`, to: o.to });
  if (awaiting.length) attention.push({ key: "a", text: `${awaiting.length} ${plural(awaiting.length, "post is", "posts are")} in internal review`, to: "/admin/calendar?status=INTERNAL_REVIEW" });
  if (overdue.length) attention.push({ key: "o", text: `${overdue.length} overdue ${plural(overdue.length, "task", "tasks")}`, to: "/admin/tasks" });
  if (drafts.length) attention.push({ key: "d", text: `${drafts.length} content ${plural(drafts.length, "idea", "ideas")} not yet in production`, to: "/admin/social" });

  return (
    <div className="dash">
      <section className="card glass d-welcome" aria-label="Welcome">
        <span className="avatar" aria-hidden="true">
          {initials(user?.name ?? "")}
        </span>
        <div className="welcome-text">
          <h1>
            {greeting(now.getHours())}, {firstName}
          </h1>
          <p className="muted small">
            {WEEKDAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}
          </p>
          <div className="welcome-facts">
            <span>
              <strong>{active.length}</strong>Active {plural(active.length, "client", "clients")}
            </span>
            <span>
              <strong>{open.length}</strong>Open {plural(open.length, "task", "tasks")}
            </span>
            <span>
              <strong style={overdue.length ? { color: "var(--danger)" } : undefined}>{overdue.length}</strong>Overdue
            </span>
          </div>
        </div>
      </section>

      <nav className="d-tiles" aria-label="Quick actions">
        <Link className="tile" to="/admin/clients?new=1">
          <span className="tile-icon">
            <UserPlus size={24} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <span>Add client</span>
        </Link>
        <Link className="tile" to="/admin/calendar?new=1">
          <span className="tile-icon">
            <Plus size={24} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <span>New post</span>
        </Link>
        <Link className="tile" to="/admin/tasks">
          <span className="tile-icon">
            <ListChecks size={24} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <span>Task Manager</span>
        </Link>
        <Link className="tile" to="/admin/calendar">
          <span className="tile-icon">
            <CalendarDays size={24} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <span>Calendar</span>
        </Link>
        <Link className="tile" to="/admin/clients">
          <span className="tile-icon">
            <ChevronRight size={24} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <span>All clients</span>
        </Link>
      </nav>

      <section className="card glass d-todo" aria-labelledby="h-todo">
        <header>
          <h2 id="h-todo">Up next</h2>
          <Link className="pill" to="/admin/tasks">
            All {open.length} {plural(open.length, "task", "tasks")}
          </Link>
        </header>
        {nextTasks.length === 0 ? (
          <p className="muted">No open to-dos. Add one from a client or the Task Manager.</p>
        ) : (
          <ul className="todo">
            {nextTasks.slice(0, 10).map((t) => (
              <li key={t.id}>
                <label className="check">
                  <input type="checkbox" checked={false} onChange={() => tick(t)} aria-label={`Mark done: ${t.title}`} />
                  <span className="todo-body">
                    <span className="todo-title">{t.title}</span>
                    <span className="muted small">{t.clientName.replace(/\s*\(demo\)/i, "")}</span>
                  </span>
                  <span className={`todo-due small ${t.dueDate && t.dueDate < today ? "late" : "muted"}`}>{t.dueDate ? (t.dueDate === today ? "Today" : fmtShort(t.dueDate)) : "No date"}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <ErrorNote message={tickError} />
      </section>

      <section className="card glass d-money" aria-labelledby="h-money">
        {tracker.loading ? <Loading /> : tracker.data ? <MoneyTracker data={tracker.data} onChanged={() => void tracker.reload()} /> : <ErrorNote message={tracker.error} />}
      </section>

      <section className="card glass d-cal" aria-label="Calendar">
        <MiniCalendar posts={posts.data} />
      </section>

      <section className="card glass d-attn" aria-labelledby="h-attn">
        <header>
          <h2 id="h-attn">Pending actions</h2>
        </header>
        {attention.length === 0 ? (
          <p className="muted">Nothing needs attention right now.</p>
        ) : (
          <ul className="rows">
            {attention.map((a) => (
              <li key={a.key}>
                <Link to={a.to}>
                  <CircleAlert size={18} strokeWidth={1.75} color="var(--warn)" aria-hidden="true" />
                  <span className="rows-main">{a.text}</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card glass d-up" aria-labelledby="h-up">
        <header>
          <h2 id="h-up">Posts coming up</h2>
          <Link className="pill" to="/admin/calendar">
            Calendar
          </Link>
        </header>
        {upcoming.length === 0 ? (
          <p className="muted">Nothing scheduled ahead. Add a post from the calendar.</p>
        ) : (
          <ul className="rows">
            {upcoming.map((p) => (
              <li key={p.id}>
                <Link to={`/admin/calendar?post=${p.id}`}>
                  <span className="avatar sm">{initials(p.clientName)}</span>
                  <span className="rows-main">
                    <strong>{p.clientName.replace(/\s*\(demo\)/i, "")}</strong>
                    <span className="muted small">
                      {p.platform} · {STATUS_LABEL[p.status]}
                    </span>
                  </span>
                  <span className="muted small">{fmtShort(p.publishDate)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card glass d-chart" aria-labelledby="h-chart">
        <header>
          <h2 id="h-chart">Content pipeline</h2>
        </header>
        {posts.data.length === 0 ? (
          <p className="muted">No content yet. The pipeline fills as you plan posts.</p>
        ) : (
          <div className="bars">
            {statusCounts.map((s) => (
              <div className="bar-row" key={s.label}>
                <span>{s.label}</span>
                <span className="bar-track" aria-hidden="true">
                  <span style={{ width: `${(s.n / maxCount) * 100}%` }} />
                </span>
                <b>{s.n}</b>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card glass d-dir" aria-labelledby="h-dir">
        <header>
          <h2 id="h-dir">Client directory</h2>
          <Link className="pill" to="/admin/clients">
            Manage
          </Link>
        </header>
        <ul className="dir">
          {active.map((c) => (
            <li key={c.id} style={{ display: "contents" }}>
              <Link to={`/c/${c.slug}`}>
                <span className="avatar">{initials(c.name)}</span>
                <strong>{c.name.replace(/\s*\(demo\)/i, "")}</strong>
                <span className="badge">
                  {c.openTasks} open {plural(c.openTasks, "task", "tasks")}
                </span>
              </Link>
            </li>
          ))}
          <li style={{ display: "contents" }}>
            <Link to="/admin/clients?new=1">
              <span className="avatar ghost">
                <Plus size={20} aria-hidden="true" />
              </span>
              <strong>Add client</strong>
              <span className="badge">Start a new profile</span>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
