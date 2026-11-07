import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Empty, ErrorNote, Loading, PageHead } from "../components/ui";
import { fmtShort, plural, todayIso } from "../format";
import { useLoad } from "../hooks";
import type { MasterTask } from "../types";

type View = "open" | "overdue" | "today" | "done";

export function TaskManagerPage() {
  const { data, error, loading, reload } = useLoad<MasterTask[]>("/api/admin/tasks");
  const [view, setView] = useState<View>("open");
  const [client, setClient] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const today = todayIso();

  const clients = useMemo(() => [...new Map((data ?? []).map((t) => [t.clientSlug, t.clientName])).entries()], [data]);
  if (loading) return <Loading />;
  if (!data) return <ErrorNote message={error} />;

  const counts = {
    open: data.filter((t) => !t.done).length,
    overdue: data.filter((t) => !t.done && t.dueDate && t.dueDate < today).length,
    today: data.filter((t) => !t.done && t.dueDate === today).length,
    done: data.filter((t) => t.done).length,
  };
  const rows = data.filter((t) => {
    if (client && t.clientSlug !== client) return false;
    if (view === "done") return t.done;
    if (t.done) return false;
    if (view === "overdue") return !!t.dueDate && t.dueDate < today;
    if (view === "today") return t.dueDate === today;
    return true;
  });

  const toggle = async (t: MasterTask) => {
    setErr(null);
    try {
      await api.patch(`/api/c/${t.clientSlug}/tasks/${t.id}`, { done: !t.done });
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't update that task");
    }
  };

  const tabs: { id: View; label: string }[] = [
    { id: "open", label: "Open" },
    { id: "today", label: "Due today" },
    { id: "overdue", label: "Overdue" },
    { id: "done", label: "Completed" },
  ];

  return (
    <div className="panel">
      <PageHead
        title="Task Manager"
        lead={`${counts.open} open ${plural(counts.open, "task", "tasks")} across ${clients.length} ${plural(clients.length, "client", "clients")}. Add or edit tasks inside each client's To-do tab.`}
      />
      <div className="tabs" role="tablist" style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={view === t.id} className={view === t.id ? "active" : ""} onClick={() => setView(t.id)}>
            {t.label}
            <span className="tab-count">{counts[t.id]}</span>
          </button>
        ))}
      </div>
      <label className="field" style={{ maxWidth: "20rem", marginBottom: "1.2rem" }}>
        <span className="field-label">Client</span>
        <select value={client} onChange={(e) => setClient(e.target.value)}>
          <option value="">All clients</option>
          {clients.map(([slug, name]) => (
            <option key={slug} value={slug}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <ErrorNote message={err} />
      {rows.length === 0 ? (
        <Empty>{view === "done" ? "No completed tasks yet." : "Nothing here. Tasks you add inside a client show up in this list."}</Empty>
      ) : (
        <ul className="task-list">
          {rows.map((t) => {
            const overdue = !t.done && t.dueDate && t.dueDate < today;
            return (
              <li key={t.id} className={`task ${t.done ? "is-done" : ""}`}>
                <label className="check">
                  <input type="checkbox" checked={t.done} onChange={() => toggle(t)} aria-label={`${t.done ? "Reopen" : "Complete"}: ${t.title}`} />
                  <span className="task-title">{t.title}</span>
                </label>
                <span className="task-meta">
                  <Link className="text-link" to={`/c/${t.clientSlug}/tasks`}>
                    {t.clientName}
                  </Link>
                  {t.dueDate ? <span className={overdue ? "overdue" : ""}> · due {fmtShort(t.dueDate)}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
