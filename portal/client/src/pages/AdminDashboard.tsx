import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Btn, Empty, ErrorNote, Field, Loading, PageHead } from "../components/ui";
import { useAction, useLoad } from "../hooks";
import { plural } from "../format";
import type { AdminClient } from "../types";

export function AdminDashboard() {
  const { data, error, loading } = useLoad<AdminClient[]>("/api/admin/clients");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const add = useAction();
  const nav = useNavigate();

  if (loading) return <Loading />;
  if (!data) return <ErrorNote message={error} />;

  const active = data.filter((c) => c.status === "ACTIVE");
  const waiting = active.reduce((n, c) => n + c.awaitingApproval, 0);
  const needing = [...active].filter((c) => c.awaitingApproval > 0).sort((a, b) => b.awaitingApproval - a.awaitingApproval);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const res = await add.run(() => api.post<AdminClient>("/api/admin/clients", { name }));
    if (res) nav(`/admin/clients/${res.id}`);
  };

  return (
    <>
      <PageHead
        title="Clients"
        lead={
          waiting > 0
            ? `${waiting} ${plural(waiting, "post is", "posts are")} waiting for client approval across ${needing.length} ${plural(needing.length, "client", "clients")}.`
            : active.length > 0
              ? "No approvals are waiting on clients."
              : "Add your first client to get started."
        }
        actions={<Btn onClick={() => setAdding(true)}>New client</Btn>}
      />

      {adding ? (
        <form className="inline-form" onSubmit={create}>
          <Field label="Client name" hint="You can invite their people on the next screen">
            <input required autoFocus maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Off The Record" />
          </Field>
          <Btn type="submit" busy={add.busy}>
            Create client
          </Btn>
          <Btn kind="quiet" onClick={() => setAdding(false)}>
            Cancel
          </Btn>
          <ErrorNote message={add.error} />
        </form>
      ) : null}

      {data.length === 0 ? (
        <Empty>No clients yet.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Awaiting approval</th>
                <th>Open to-dos</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className={c.status !== "ACTIVE" ? "dim" : ""}>
                  <td data-label="Client">
                    <Link className="strong-link" to={`/c/${c.slug}`}>
                      {c.name}
                    </Link>
                  </td>
                  <td data-label="Awaiting approval">{c.awaitingApproval > 0 ? <strong className="attn">{c.awaitingApproval}</strong> : <span className="muted">None</span>}</td>
                  <td data-label="Open to-dos">{c.openTasks > 0 ? c.openTasks : <span className="muted">None</span>}</td>
                  <td data-label="Status">{c.status === "ACTIVE" ? "Active" : c.status === "PAUSED" ? "Paused" : "Archived"}</td>
                  <td>
                    <div className="actions-inner">
                      <Link className="text-link" to={`/c/${c.slug}`}>
                        Open portal
                      </Link>
                      <Link className="text-link" to={`/admin/clients/${c.id}`}>
                        People and settings
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
