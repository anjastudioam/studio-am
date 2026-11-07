import { Search } from "lucide-react";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtShort } from "../format";
import { useLoad } from "../hooks";
import { AdminClient, MasterPost, MasterTask, STATUS_LABEL } from "../types";

type Hit = { key: string; label: string; sub: string; to: string };

export function GlobalSearch() {
  const clientsQ = useLoad<AdminClient[]>("/api/admin/clients");
  const postsQ = useLoad<MasterPost[]>("/api/admin/posts");
  const tasksQ = useLoad<MasterTask[]>("/api/admin/tasks");
  const clients = clientsQ.data ?? [];
  const posts = postsQ.data ?? [];
  const tasks = tasksQ.data ?? [];
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

