import { FormEvent, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Btn, ErrorNote, Field, Loading, PageHead } from "../components/ui";
import { useAction, useLoad } from "../hooks";

type Member = { id: string; email: string; name: string; active: boolean; hasPassword: boolean; lastLoginAt: string | null };

const HINT = "At least 12 characters. A phrase of three or four random words works well.";

function ChangeOwnPassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [done, setDone] = useState(false);
  const act = useAction();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setDone(false);
    const ok = await act.run(async () => {
      await api.post("/api/auth/password", { currentPassword: current, newPassword: next });
      return true;
    });
    if (ok) {
      setCurrent("");
      setNext("");
      setDone(true);
    }
  };
  return (
    <form className="inline-form" onSubmit={submit}>
      <Field label="Current password">
        <input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="New password" hint={HINT}>
        <input type="password" required minLength={12} maxLength={200} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <Btn type="submit" busy={act.busy}>
        Change my password
      </Btn>
      <ErrorNote message={act.error} />
      {done ? <p className="ok-note">Password changed. Your other devices were signed out.</p> : null}
    </form>
  );
}

export function TeamPage({ bare = false }: { bare?: boolean }) {
  const { user } = useAuth();
  const { data, error, loading, reload } = useLoad<Member[]>("/api/admin/team");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  const add = useAction();
  const reset = useAction();
  const toggle = useAction();

  if (loading) return <Loading />;
  if (!data) return <ErrorNote message={error} />;

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const res = await add.run(() => api.post<Member>("/api/admin/team", form));
    if (res) {
      setForm({ name: "", email: "", password: "" });
      setAdding(false);
      reload();
    }
  };
  const doReset = async (e: FormEvent) => {
    e.preventDefault();
    const res = await reset.run(() => api.patch<Member>(`/api/admin/team/${resetId}`, { password: resetPw }));
    if (res) {
      setResetId(null);
      setResetPw("");
      reload();
    }
  };

  return (
    <>
      {bare ? (
        <div className="page-actions" style={{ marginBottom: "1rem", justifyContent: "space-between", flexWrap: "wrap" }}>
          <p className="muted" style={{ maxWidth: "40rem" }}>
            Everyone here signs in with their email and password and sees all clients. Passwords are stored scrambled, so nobody can read them, only reset them.
          </p>
          <Btn onClick={() => setAdding(true)}>Add person</Btn>
        </div>
      ) : (
        <PageHead
          title="Team"
          lead="Everyone here can sign in with their email and password and see all clients. Passwords are stored scrambled, so nobody can read them, only reset them."
          actions={<Btn onClick={() => setAdding(true)}>Add person</Btn>}
        />
      )}

      {adding ? (
        <form className="inline-form" onSubmit={create}>
          <Field label="Name">
            <input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="First password" hint={`${HINT} Share it in person or on a private chat, then ask them to change it.`}>
            <input type="text" required minLength={12} maxLength={200} autoComplete="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Btn type="submit" busy={add.busy}>
            Add person
          </Btn>
          <Btn kind="quiet" onClick={() => setAdding(false)}>
            Cancel
          </Btn>
          <ErrorNote message={add.error} />
        </form>
      ) : null}

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((m) => (
            <tr key={m.id} className={m.active ? "" : "dim"}>
              <td data-label="Name">
                <strong>{m.name}</strong>
                {m.id === user?.id ? <span className="muted"> (you)</span> : null}
              </td>
              <td data-label="Email">{m.email}</td>
              <td data-label="Status">{!m.active ? "Access off" : m.hasPassword ? "Active" : "No password yet"}</td>
              <td>
                <div className="actions-inner">
                  <Btn kind="quiet" onClick={() => { setResetId(resetId === m.id ? null : m.id); setResetPw(""); }}>
                    Set new password
                  </Btn>
                  {m.id !== user?.id ? (
                    <Btn
                      kind="quiet"
                      busy={toggle.busy}
                      onClick={async () => {
                        await toggle.run(() => api.patch(`/api/admin/team/${m.id}`, { active: !m.active }));
                        reload();
                      }}
                    >
                      {m.active ? "Turn access off" : "Turn access on"}
                    </Btn>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {resetId ? (
        <form className="inline-form" style={{ marginTop: "1.5rem" }} onSubmit={doReset}>
          <Field label={`New password for ${data.find((m) => m.id === resetId)?.name ?? ""}`} hint={`${HINT} They will be signed out on their devices.`}>
            <input type="text" required minLength={12} maxLength={200} autoComplete="off" autoFocus value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
          </Field>
          <Btn type="submit" busy={reset.busy}>
            Save password
          </Btn>
          <Btn kind="quiet" onClick={() => setResetId(null)}>
            Cancel
          </Btn>
          <ErrorNote message={reset.error} />
        </form>
      ) : null}

      <h3 style={{ margin: "2rem 0 1rem" }}>Change your own password</h3>
      <ChangeOwnPassword />
    </>
  );
}
