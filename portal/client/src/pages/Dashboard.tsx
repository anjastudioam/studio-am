import { ChevronRight, CalendarDays, CircleAlert, Plus, Quote, Search, Users } from "lucide-react";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { actionLabel, timeAgo } from "../activity";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorNote, Loading } from "../components/ui";
import { fmtShort, plural, todayIso } from "../format";
import { useLoad } from "../hooks";
import { AdminClient, AuditRow, MasterPost, MasterTask, STATUS_LABEL } from "../types";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function greeting(h: number) {
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  const h = now.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return (
    <div className="clock" aria-live="off">
      <div className="clock-time">
        <span>
          {String(h12).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
        </span>
        <small>{h < 12 ? "AM" : "PM"}</small>
      </div>
      <div className="clock-date">
        {WEEKDAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}
      </div>
    </div>
  );
}

type Hit = { key: string; label: string; sub: string; to: string };

function SearchBar({ clients, posts, tasks }: { clients: AdminClient[]; posts: MasterPost[]; tasks: MasterTask[] }) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    const out: Hit[] = [];
    for (const c of clients) if (c.status !== "ARCHIVED" && c.name.toLowerCase().includes(n)) out.push({ key: "c" + c.id, label: c.name, sub: "Client", to: `/c/${c.slug}` });
    for (const p of posts) {
      if ([p.clientName, p.platform, p.caption, p.pillar ?? ""].join(" ").toLowerCase().includes(n))
        out.push({ key: "p" + p.id, label: `${p.clientName}: ${p.platform}`, sub: `Post, ${fmtShort(p.publishDate)}, ${STATUS_LABEL[p.status]}`, to: `/admin/calendar?post=${p.id}` });
    }
    for (const t of tasks) {
      if (!t.done && [t.clientName, t.title].join(" ").toLowerCase().includes(n))
        out.push({ key: "t" + t.id, label: t.title, sub: `To-do, ${t.clientName}`, to: `/c/${t.clientSlug}/tasks` });
    }
    return out.slice(0, 8);
  }, [q, clients, posts, tasks]);

  const go = (h: Hit) => {
    setQ("");
    nav(h.to);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && hits[active]) {
      go(hits[active]);
    } else if (e.key === "Escape") {
      setQ("");
      input.current?.blur();
    }
  };

  return (
    <div className="search">
      <Search size={18} strokeWidth={1.75} aria-hidden="true" />
      <input
        ref={input}
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search clients, posts or to-dos"
        aria-label="Search clients, posts or to-dos"
        autoComplete="off"
      />
      <kbd>{isMac ? "⌘K" : "Ctrl K"}</kbd>
      {q.trim() ? (
        <ul className="search-results" role="listbox">
          {hits.length === 0 ? <li className="search-empty">No matches for “{q}”.</li> : null}
          {hits.map((h, i) => (
            <li key={h.key} role="option" aria-selected={i === active}>
              <button className={i === active ? "active" : ""} onMouseEnter={() => setActive(i)} onClick={() => go(h)}>
                <span>{h.label}</span>
                <span className="muted small">{h.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export function DashboardPage() {
  const { user } = useAuth();
  const clients = useLoad<AdminClient[]>("/api/admin/clients");
  const posts = useLoad<MasterPost[]>("/api/admin/posts");
  const tasks = useLoad<MasterTask[]>("/api/admin/tasks");
  const audit = useLoad<AuditRow[]>("/api/admin/audit");
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [tickError, setTickError] = useState<string | null>(null);

  if (clients.loading || posts.loading || tasks.loading) return <Loading />;
  if (!clients.data || !posts.data || !tasks.data) return <ErrorNote message={clients.error ?? posts.error ?? tasks.error} />;

  const today = todayIso();
  const active = clients.data.filter((c) => c.status === "ACTIVE");
  const firstName = user?.name.split(" ")[0] ?? "";
  const hour = new Date().getHours();

  const upcoming = posts.data.filter((p) => p.publishDate >= today && p.status !== "POSTED").slice(0, 5);
  const todayPosts = posts.data.filter((p) => p.publishDate === today);
  const awaiting = posts.data.filter((p) => p.status === "AWAITING_APPROVAL");
  const drafts = posts.data.filter((p) => p.status === "DRAFT");
  const allTasks = tasks.data.map((t) => (ticked.has(t.id) ? { ...t, done: true } : t));
  const openTasks = allTasks.filter((t) => !t.done);
  const overdue = openTasks.filter((t) => t.dueDate && t.dueDate < today);
  const doneCount = allTasks.length - openTasks.length;
  const clientName = new Map(clients.data.map((c) => [c.id, c.name]));

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
  if (awaiting.length) attention.push({ key: "a", text: `${awaiting.length} ${plural(awaiting.length, "post is", "posts are")} waiting on client approval`, to: "/admin/calendar?status=AWAITING_APPROVAL" });
  if (overdue.length) attention.push({ key: "o", text: `${overdue.length} overdue ${plural(overdue.length, "to-do", "to-dos")}`, to: `/c/${overdue[0].clientSlug}/tasks` });
  if (drafts.length) attention.push({ key: "d", text: `${drafts.length} ${plural(drafts.length, "draft post", "draft posts")} not sent for approval`, to: "/admin/calendar?status=DRAFT" });

  return (
    <div className="dash">
      <div className="dash-greet chip-glass">
        {greeting(hour)}, {firstName} <span aria-hidden="true">👋</span>
      </div>
      <Clock />
      <div className="dash-today glass">
        <CalendarDays size={34} strokeWidth={1.4} aria-hidden="true" />
        <div>
          <div className="today-big">
            {todayPosts.length} {plural(todayPosts.length, "post", "posts")} today
          </div>
          <div className="muted">{awaiting.length} awaiting approval</div>
          <div className="muted small">
            {active.length} active {plural(active.length, "client", "clients")}
          </div>
        </div>
      </div>
      <SearchBar clients={clients.data} posts={posts.data} tasks={tasks.data} />

      <section className="card c-upnext glass" aria-labelledby="h-upnext">
        <header>
          <h2 id="h-upnext">Up next</h2>
          <Link className="pill" to="/admin/calendar">
            View all
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
                    <strong>{p.clientName}</strong>
                    <span className="muted small">
                      {p.platform} · {STATUS_LABEL[p.status]}
                    </span>
                  </span>
                  <span className="muted small">{fmtShort(p.publishDate)}</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card c-clients glass" aria-labelledby="h-clients">
        <header>
          <h2 id="h-clients">Clients</h2>
          <Link className="pill" to="/admin/clients">
            Manage
          </Link>
        </header>
        <ul className="tiles">
          {active.slice(0, 5).map((c) => (
            <li key={c.id}>
              <Link to={`/c/${c.slug}`}>
                <span className="avatar">{initials(c.name)}</span>
                <span className="tile-name">{c.name.replace(/\s*\(demo\)/i, "")}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link to="/admin/clients?new=1">
              <span className="avatar ghost">
                <Plus size={18} aria-hidden="true" />
              </span>
              <span className="tile-name">Add</span>
            </Link>
          </li>
        </ul>
      </section>

      <section className="card c-todo glass" aria-labelledby="h-todo">
        <header>
          <h2 id="h-todo">To-do</h2>
          <Link className="pill" to={openTasks[0] ? `/c/${openTasks[0].clientSlug}/tasks` : "/admin/clients"}>
            Open
          </Link>
        </header>
        {openTasks.length === 0 ? (
          <p className="muted">All clear. Nothing open across your clients.</p>
        ) : (
          <ul className="todo">
            {openTasks.slice(0, 5).map((t) => (
              <li key={t.id}>
                <label className="check">
                  <input type="checkbox" checked={false} onChange={() => tick(t)} aria-label={`Mark done: ${t.title}`} />
                  <span>
                    <span className="todo-title">{t.title}</span>
                    <span className="muted small">
                      {t.clientName.replace(/\s*\(demo\)/i, "")}
                      {t.dueDate ? ` · due ${fmtShort(t.dueDate)}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <ErrorNote message={tickError} />
        <div className="progress" aria-label={`Completed ${doneCount} of ${allTasks.length}`}>
          <span className="small muted">
            Completed {doneCount} / {allTasks.length}
          </span>
          <span className="bar">
            <span style={{ width: `${allTasks.length ? (doneCount / allTasks.length) * 100 : 0}%` }} />
          </span>
        </div>
      </section>

      <aside className="card c-quick glass" aria-label="Quick actions">
        <div className="quick-art">
          <img src="/logo.png" alt="Studio AM" width={96} height={96} />
        </div>
        <div className="quick-body">
          <h2>Quick add</h2>
          <Link className="quick-btn" to="/admin/calendar?new=1">
            <Plus size={16} aria-hidden="true" /> New post
          </Link>
          <Link className="quick-btn" to="/admin/clients?new=1">
            <Users size={16} aria-hidden="true" /> New client
          </Link>
          <Link className="quick-btn" to="/admin/calendar">
            <CalendarDays size={16} aria-hidden="true" /> Calendar
          </Link>
        </div>
      </aside>

      <section className="card c-attn glass" aria-labelledby="h-attn">
        <header>
          <h2 id="h-attn">Needs attention</h2>
        </header>
        {attention.length === 0 ? (
          <p className="muted">Nothing needs attention right now.</p>
        ) : (
          <ul className="rows">
            {attention.map((a) => (
              <li key={a.key}>
                <Link to={a.to}>
                  <CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" />
                  <span className="rows-main">{a.text}</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card c-quote glass" aria-label="Studio AM">
        <Quote size={20} strokeWidth={1.5} aria-hidden="true" />
        <p>Where creative thinking meets strategic execution.</p>
        <span className="muted small">Studio AM</span>
      </section>

      <section className="card c-activity glass" aria-labelledby="h-act">
        <header>
          <h2 id="h-act">Recent activity</h2>
        </header>
        {!audit.data || audit.data.filter((a) => a.action !== "auth.login").length === 0 ? (
          <p className="muted">Changes you make will show up here.</p>
        ) : (
          <ul className="rows plain">
            {audit.data
              .filter((a) => a.action !== "auth.login")
              .slice(0, 4)
              .map((a) => (
                <li key={a.id}>
                  <span className="rows-main">
                    <strong>{actionLabel(a.action)}</strong>
                    <span className="muted small">{a.clientId ? clientName.get(a.clientId) ?? "" : ""}</span>
                  </span>
                  <span className="muted small">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <p className="dash-foot chip-glass">Where creative thinking meets strategic execution.</p>
    </div>
  );
}
