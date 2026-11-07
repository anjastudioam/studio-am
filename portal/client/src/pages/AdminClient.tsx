import { FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { Btn, ErrorNote, Field, Loading, PageHead } from "../components/ui";
import { fmtDateTime } from "../format";
import { actionLabel } from "../activity";
import { useAction, useLoad } from "../hooks";
import type { AdminClient, AuditRow } from "../types";

export function AdminClientPage() {
  const { id = "" } = useParams();
  const clients = useLoad<AdminClient[]>("/api/admin/clients");
  const audit = useLoad<AuditRow[]>(`/api/admin/audit?clientId=${id}`);
  const [name, setName] = useState<string | null>(null);
  const settings = useAction();

  if (clients.loading) return <Loading />;
  const client = clients.data?.find((c) => c.id === id);
  if (!client) return <ErrorNote message={clients.error ?? "Client not found"} />;

  const rename = async (e: FormEvent) => {
    e.preventDefault();
    const res = await settings.run(() => api.patch(`/api/admin/clients/${id}`, { name: (name ?? client.name).trim() }));
    if (res) {
      setName(null);
      await clients.reload();
    }
  };

  return (
    <>
      <PageHead
        title={client.name}
        lead={
          <>
            <Link className="text-link" to="/admin/clients">
              All clients
            </Link>{" "}
            ·{" "}
            <Link className="text-link" to={`/c/${client.slug}`}>
              Open portal
            </Link>
          </>
        }
      />

      <section className="block">
        <h2>Settings</h2>
        <form className="inline-form" onSubmit={rename}>
          <Field label="Client name">
            <input required maxLength={120} value={name ?? client.name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Btn type="submit" busy={settings.busy} disabled={name === null || name.trim() === client.name}>
            Save name
          </Btn>
        </form>
        <div className="inline-form">
          <Field label="Status" hint="Archived clients are hidden from the switcher and the master calendar">
            <select
              value={client.status}
              onChange={async (e) => {
                await settings.run(() => api.patch(`/api/admin/clients/${id}`, { status: e.target.value }));
                await clients.reload();
              }}
            >
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </Field>
          <ErrorNote message={settings.error} />
        </div>
      </section>

      <section className="block">
        <h2>Recent activity</h2>
        {!audit.data || audit.data.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <ul className="history">
            {audit.data.slice(0, 15).map((a) => (
              <li key={a.id}>
                <span>{actionLabel(a.action)}</span>
                <span className="muted small">{fmtDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
