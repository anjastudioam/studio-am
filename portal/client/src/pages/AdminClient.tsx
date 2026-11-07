import { FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { Btn, Empty, ErrorNote, Field, Loading, PageHead } from "../components/ui";
import { fmtDateTime } from "../format";
import { useAction, useLoad } from "../hooks";
import type { AdminClient, AdminUser, AuditRow } from "../types";

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Signed in",
  "client.create": "Client created",
  "client.update": "Client settings changed",
  "user.invite": "Person invited",
  "user.activate": "Access turned on",
  "user.deactivate": "Access turned off",
  "post.approve": "Post approved by client",
  "post.request_changes": "Client requested changes on a post",
};
const actionLabel = (a: string) => {
  if (ACTION_LABELS[a]) return ACTION_LABELS[a];
  const [section, verb] = a.split(".");
  const v = verb === "create" ? "added to" : verb === "update" ? "changed in" : verb === "delete" ? "removed from" : verb;
  return `Item ${v} ${section}`;
};

export function AdminClientPage() {
  const { id = "" } = useParams();
  const clients = useLoad<AdminClient[]>("/api/admin/clients");
  const users = useLoad<AdminUser[]>(`/api/admin/clients/${id}/users`);
  const audit = useLoad<AuditRow[]>(`/api/admin/audit?clientId=${id}`);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [send, setSend] = useState(true);
  const invite = useAction();
  const settings = useAction();
  const toggle = useAction();
  const [notice, setNotice] = useState<string | null>(null);

  if (clients.loading || users.loading) return <Loading />;
  const client = clients.data?.find((c) => c.id === id);
  if (!client || !users.data) return <ErrorNote message={clients.error ?? users.error ?? "Client not found"} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await invite.run(() => api.post(`/api/admin/clients/${id}/users`, { name, email, sendInvite: send }));
    if (res) {
      setNotice(send ? `Invite sent to ${email}.` : `${email} can now sign in.`);
      setName("");
      setEmail("");
      await users.reload();
    }
  };

  return (
    <>
      <PageHead
        title={client.name}
        lead={
          <>
            <Link className="text-link" to="/admin">
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
        <div className="inline-form">
          <Field label="Status" hint="Archived clients can no longer sign in">
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
        <h2>People with access</h2>
        {users.data.length === 0 ? (
          <Empty>Nobody has access yet. Invite a contact below.</Empty>
        ) : (
          <ul className="row-list">
            {users.data.map((u) => (
              <li key={u.id}>
                <div className="row-static">
                  <span className="row-title">
                    {u.name} {u.active ? null : <span className="muted">(access off)</span>}
                  </span>
                  <span className="row-sub">
                    {u.email} · {u.lastLoginAt ? `last signed in ${fmtDateTime(u.lastLoginAt)}` : "hasn't signed in yet"}
                  </span>
                </div>
                <Btn
                  kind="quiet"
                  busy={toggle.busy}
                  onClick={async () => {
                    await toggle.run(() => api.patch(`/api/admin/users/${u.id}`, { active: !u.active }));
                    await users.reload();
                  }}
                >
                  {u.active ? "Turn off access" : "Turn on access"}
                </Btn>
              </li>
            ))}
          </ul>
        )}
        <ErrorNote message={toggle.error} />
        <form className="inline-form" onSubmit={submit}>
          <Field label="Name">
            <input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email">
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} />
            <span>Email them a sign-in link now</span>
          </label>
          <Btn type="submit" busy={invite.busy}>
            Invite
          </Btn>
          <ErrorNote message={invite.error} />
          {notice ? <p className="ok-note">{notice}</p> : null}
        </form>
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
