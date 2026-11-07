import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Btn, ConfirmDelete, Drawer, Empty, ErrorNote, Field, Loading, PageHead } from "../components/ui";
import { fmtShort, plural, todayIso } from "../format";
import { useLoad } from "../hooks";
import { AdminClient, MasterTask, PRIORITIES, Priority, Subtask, TASK_STATUS, TaskStatus } from "../types";

type View = "open" | "overdue" | "today" | "done";
const PRIORITY_RANK: Record<Priority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
const priorityLabel = (p: Priority) => PRIORITIES.find((x) => x.value === p)?.label ?? "Normal";
const clean = (name: string) => name.replace(/\s*\(demo\)/i, "");
const dueLabel = (d: string | null, today: string) => (!d ? "No date" : d === today ? "Today" : fmtShort(d));
const newId = () => Math.random().toString(36).slice(2, 10);

function PriorityChip({ p }: { p: Priority }) {
  if (p === "NORMAL") return null;
  return <span className={`tone ${p === "URGENT" ? "tone-bad" : p === "HIGH" ? "tone-warn" : ""}`}>{priorityLabel(p)}</span>;
}

function Progress({ subtasks }: { subtasks: Subtask[] }) {
  if (!subtasks.length) return null;
  const done = subtasks.filter((s) => s.done).length;
  return (
    <span className="muted small" title="Subtasks done">
      {done}/{subtasks.length} steps
    </span>
  );
}

function TaskEditor({ task, onDone, onClose }: { task: MasterTask; onDone: () => void; onClose: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [due, setDue] = useState(task.dueDate ?? "");
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [subs, setSubs] = useState<Subtask[]>(task.subtasks);
  const [newSub, setNewSub] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const url = `/api/c/${task.clientSlug}/tasks/${task.id}`;

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.patch(url, { title: title.trim(), dueDate: due || null, priority, status, notes: notes.trim() || null, subtasks: subs });
      onDone();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save that task");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      await api.del(url);
      onDone();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't delete that task");
    }
  };
  const addSub = () => {
    const t = newSub.trim();
    if (!t) return;
    setSubs([...subs, { id: newId(), title: t.slice(0, 200), done: false }]);
    setNewSub("");
  };

  return (
    <div className="drawer-form" style={{ borderTop: 0, paddingTop: 0 }}>
      <p className="muted small" style={{ marginTop: 0 }}>
        <Link className="text-link" to={`/c/${task.clientSlug}`}>
          {clean(task.clientName)}
        </Link>
      </p>
      <Field label="Task">
        <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <div className="rec-form">
        <Field label="Due date" hint="Shows on the calendar">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label="Priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            {TASK_STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Notes">
        <textarea rows={3} maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="field">
        <span className="field-label">Steps</span>
        <ul className="subtasks">
          {subs.map((s) => (
            <li key={s.id} className={s.done ? "is-done" : ""}>
              <label className="check">
                <input type="checkbox" checked={s.done} onChange={() => setSubs(subs.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))} />
                <span className="task-title">{s.title}</span>
              </label>
              <button type="button" className="btn btn-quiet" aria-label={`Remove step: ${s.title}`} onClick={() => setSubs(subs.filter((x) => x.id !== s.id))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="sub-add">
          <input
            value={newSub}
            maxLength={200}
            placeholder="Add a step"
            aria-label="New step"
            onChange={(e) => setNewSub(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSub();
              }
            }}
          />
          <Btn kind="quiet" onClick={addSub}>
            Add step
          </Btn>
        </div>
      </div>
      <ErrorNote message={err} />
      <div className="drawer-actions">
        <Btn onClick={save} busy={busy} disabled={!title.trim()}>
          Save changes
        </Btn>
        <ConfirmDelete onConfirm={remove} label="Delete task" />
      </div>
    </div>
  );
}

export function TaskManagerPage() {
  const { data, error, loading, reload } = useLoad<MasterTask[]>("/api/admin/tasks");
  const clientList = useLoad<AdminClient[]>("/api/admin/clients");
  const [view, setView] = useState<View>("open");
  const [layout, setLayout] = useState<"list" | "board">("list");
  const [client, setClient] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newClient, setNewClient] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<Priority>("NORMAL");
  const [adding, setAdding] = useState(false);
  const today = todayIso();

  const clients = useMemo(() => [...new Map((data ?? []).map((t) => [t.clientSlug, t.clientName])).entries()], [data]);
  const activeClients = (clientList.data ?? []).filter((c) => c.status !== "ARCHIVED");
  if (loading) return <Loading />;
  if (!data) return <ErrorNote message={error} />;

  const counts = {
    open: data.filter((t) => !t.done).length,
    overdue: data.filter((t) => !t.done && t.dueDate && t.dueDate < today).length,
    today: data.filter((t) => !t.done && t.dueDate === today).length,
    done: data.filter((t) => t.done).length,
  };
  const filtered = data.filter((t) => (!client || t.clientSlug === client) && (!priorityFilter || t.priority === priorityFilter));
  const rows = filtered
    .filter((t) => {
      if (view === "done") return t.done;
      if (t.done) return false;
      if (view === "overdue") return !!t.dueDate && t.dueDate < today;
      if (view === "today") return t.dueDate === today;
      return true;
    })
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  const patch = async (t: MasterTask, body: object) => {
    setErr(null);
    try {
      await api.patch(`/api/c/${t.clientSlug}/tasks/${t.id}`, body);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't update that task");
    }
  };

  const chosenClient = newClient || activeClients[0]?.slug || "";
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosenClient) return;
    setAdding(true);
    setErr(null);
    try {
      await api.post(`/api/c/${chosenClient}/tasks`, { title: title.trim(), priority, ...(due ? { dueDate: due } : {}) });
      setTitle("");
      setDue("");
      setPriority("NORMAL");
      await reload();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Couldn't add that task");
    } finally {
      setAdding(false);
    }
  };

  const tabs: { id: View; label: string }[] = [
    { id: "open", label: "Open" },
    { id: "today", label: "Due today" },
    { id: "overdue", label: "Overdue" },
    { id: "done", label: "Completed" },
  ];
  const open = data.find((t) => t.id === openId) ?? null;

  const meta = (t: MasterTask) => (
    <span className="task-meta">
      <PriorityChip p={t.priority} /> <Progress subtasks={t.subtasks} />{" "}
      <span className="muted">{clean(t.clientName)}</span>
      <span className={!t.done && t.dueDate && t.dueDate < today ? "overdue" : ""}> · {dueLabel(t.dueDate, today)}</span>
    </span>
  );

  return (
    <div className="panel">
      <PageHead
        title="Task Manager"
        lead={`${counts.open} open ${plural(counts.open, "task", "tasks")} across ${clients.length} ${plural(clients.length, "client", "clients")}.`}
        actions={
          <div className="seg" role="group" aria-label="Layout">
            <button className={layout === "list" ? "active" : ""} onClick={() => setLayout("list")}>
              List
            </button>
            <button className={layout === "board" ? "active" : ""} onClick={() => setLayout("board")}>
              Board
            </button>
          </div>
        }
      />

      <form className="tm-add" onSubmit={submit}>
        <Field label="New task">
          <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Send revised logo options" />
        </Field>
        <Field label="Client">
          <select value={chosenClient} onChange={(e) => setNewClient(e.target.value)}>
            {activeClients.map((c) => (
              <option key={c.id} value={c.slug}>
                {clean(c.name)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due (today if blank)">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label="Priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Btn type="submit" busy={adding} disabled={!chosenClient}>
          Add task
        </Btn>
      </form>

      {layout === "list" ? (
        <div className="tabs" role="tablist" style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={view === t.id} className={view === t.id ? "active" : ""} onClick={() => setView(t.id)}>
              {t.label}
              <span className="tab-count">{counts[t.id]}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="filters">
        <Field label="Client">
          <select value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">All clients</option>
            {clients.map(([slug, name]) => (
              <option key={slug} value={slug}>
                {clean(name)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="">Any priority</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ErrorNote message={err} />

      {layout === "board" ? (
        <div className="board">
          {TASK_STATUS.map((col) => {
            const items = filtered
              .filter((t) => t.status === col.value)
              .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
            return (
              <section key={col.value} className="board-col" aria-label={col.label}>
                <header>
                  <strong>{col.label}</strong>
                  <span className="muted">{items.length}</span>
                </header>
                {items.slice(0, col.value === "DONE" ? 15 : 100).map((t) => (
                  <article key={t.id} className="board-card">
                    <button className="board-title" onClick={() => setOpenId(t.id)}>
                      {t.title}
                    </button>
                    {meta(t)}
                    <select aria-label={`Move: ${t.title}`} value={t.status} onChange={(e) => patch(t, { status: e.target.value })}>
                      {TASK_STATUS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      ) : rows.length === 0 ? (
        <Empty>{view === "done" ? "No completed tasks yet." : view === "open" ? "No open tasks. Add one above." : "Nothing here."}</Empty>
      ) : (
        <ul className="task-list">
          {rows.map((t) => (
            <li key={t.id} className={`task ${t.done ? "is-done" : ""}`}>
              <label className="check">
                <input type="checkbox" checked={t.done} onChange={() => patch(t, { done: !t.done })} aria-label={`${t.done ? "Reopen" : "Complete"}: ${t.title}`} />
                <span className="task-title">{t.title}</span>
              </label>
              {meta(t)}
              <Btn kind="quiet" onClick={() => setOpenId(t.id)}>
                Edit
              </Btn>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <Drawer title="Edit task" onClose={() => setOpenId(null)}>
          <TaskEditor key={open.id} task={open} onDone={() => void reload()} onClose={() => setOpenId(null)} />
        </Drawer>
      ) : null}
    </div>
  );
}
