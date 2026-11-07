import { FormEvent, useState } from "react";
import { api } from "../api";
import { usePortal } from "../components/Shell";
import { Btn, ConfirmDelete, Empty, ErrorNote, Field, Loading, PageHead } from "../components/ui";
import { fmtShort, todayIso } from "../format";
import { useAction, useLoad } from "../hooks";
import type { Task } from "../types";

export function TaskRow({ task, onChange, onDelete }: { task: Task; onChange: (t: Task) => void; onDelete?: () => void }) {
  const { slug } = usePortal();
  const { busy, error, run } = useAction();
  const overdue = !task.done && task.dueDate && task.dueDate < todayIso();
  return (
    <li className={`task ${task.done ? "is-done" : ""}`}>
      <label className="check">
        <input
          type="checkbox"
          checked={task.done}
          disabled={busy}
          onChange={async (e) => {
            const done = e.target.checked;
            const res = await run(() => api.patch<Task>(`/api/c/${slug}/tasks/${task.id}`, { done }));
            if (res) onChange(res);
          }}
        />
        <span className="task-title">{task.title}</span>
      </label>
      <span className="task-meta">
        {task.owner === "AGENCY" ? "Studio AM" : "You"}
        {task.dueDate ? <span className={overdue ? "overdue" : ""}> · due {fmtShort(task.dueDate)}</span> : null}
      </span>
      {onDelete ? <ConfirmDelete onConfirm={onDelete} /> : null}
      {error ? <ErrorNote message={error} /> : null}
    </li>
  );
}

export function TasksPage() {
  const { slug, isAdmin, reloadHome } = usePortal();
  const { data, setData, error, loading, reload } = useLoad<Task[]>(`/api/c/${slug}/tasks`);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [owner, setOwner] = useState<"AGENCY" | "CLIENT">("AGENCY");
  const add = useAction();

  if (loading) return <Loading />;
  if (!data) return <ErrorNote message={error} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await add.run(() =>
      api.post<Task>(`/api/c/${slug}/tasks`, { title, ...(due ? { dueDate: due } : {}), ...(isAdmin ? { owner } : {}) }),
    );
    if (res) {
      setTitle("");
      setDue("");
      await reload();
      await reloadHome();
    }
  };

  const open = data.filter((t) => !t.done);
  const done = data.filter((t) => t.done);
  const update = (t: Task) => {
    setData(data.map((x) => (x.id === t.id ? t : x)));
    void reloadHome();
  };

  return (
    <>
      <PageHead title="To-do" lead="What's next, and who it's waiting on." />
      <form className="inline-form" onSubmit={submit}>
        <Field label="New to-do">
          <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isAdmin ? "e.g. Send brand questionnaire" : "e.g. Send us your logo files"} />
        </Field>
        <Field label="Due">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        {isAdmin ? (
          <Field label="Waiting on">
            <select value={owner} onChange={(e) => setOwner(e.target.value as "AGENCY" | "CLIENT")}>
              <option value="AGENCY">Studio AM</option>
              <option value="CLIENT">Client</option>
            </select>
          </Field>
        ) : null}
        <Btn type="submit" busy={add.busy}>
          Add to-do
        </Btn>
        <ErrorNote message={add.error} />
      </form>

      <section className="block">
        <h2>Open</h2>
        {open.length === 0 ? (
          <Empty>Nothing open right now.</Empty>
        ) : (
          <ul className="task-list">
            {open.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onChange={update}
                onDelete={
                  isAdmin
                    ? async () => {
                        await api.del(`/api/c/${slug}/tasks/${t.id}`);
                        await reload();
                        await reloadHome();
                      }
                    : undefined
                }
              />
            ))}
          </ul>
        )}
      </section>
      {done.length > 0 ? (
        <section className="block">
          <h2>Done</h2>
          <ul className="task-list">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} onChange={update} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
