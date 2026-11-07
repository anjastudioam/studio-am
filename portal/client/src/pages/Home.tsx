import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Tone } from "../components/Records";
import { usePortal } from "../components/Shell";
import { Btn, Drawer, ErrorNote, Field, Loading, PageHead } from "../components/ui";
import { fmtDate, plural } from "../format";
import { useAction, useLoad } from "../hooks";
import { ModuleDef, RecordRow, money, useModules } from "../modules";
import { AdminClient, CLIENT_STATUS, ClientProfile, ClientStatus } from "../types";
import { TaskRow } from "./Tasks";
import type { Task } from "../types";

const SERVICES = ["Branding", "Social media", "Website", "Marketing", "Audit", "Consulting"];

function DetailsForm({ client, onDone, onClose }: { client: AdminClient; onDone: () => Promise<void>; onClose: () => void }) {
  const p = client.profile ?? {};
  const [f, setF] = useState({
    status: client.status as ClientStatus,
    contactName: p.contactName ?? "", email: p.email ?? "", phone: p.phone ?? "", website: p.website ?? "", industry: p.industry ?? "", address: p.address ?? "",
    services: p.services ?? [], monthlyFee: p.monthlyFee == null ? "" : String(p.monthlyFee), contractStart: p.contractStart ?? "", contractEnd: p.contractEnd ?? "", notes: p.notes ?? "",
  });
  const save = useAction();
  const text = (k: keyof typeof f, label: string, type = "text") => (
    <Field label={label}>
      <input type={type} value={f[k] as string} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </Field>
  );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nul = (v: string) => v.trim() || null;
    const profile: Record<string, unknown> = {
      contactName: nul(f.contactName), email: nul(f.email), phone: nul(f.phone), website: nul(f.website), industry: nul(f.industry), address: nul(f.address),
      services: f.services, monthlyFee: f.monthlyFee === "" ? null : Number(f.monthlyFee), contractStart: nul(f.contractStart), contractEnd: nul(f.contractEnd), notes: nul(f.notes),
    };
    const res = await save.run(() => api.patch(`/api/admin/clients/${client.id}`, { status: f.status, profile }));
    if (res) {
      await onDone();
      onClose();
    }
  };
  return (
    <form className="drawer-form rec-form" onSubmit={submit}>
      <Field label="Status">
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as ClientStatus })}>
          {(Object.keys(CLIENT_STATUS) as ClientStatus[]).map((s) => (
            <option key={s} value={s}>{CLIENT_STATUS[s]}</option>
          ))}
        </select>
      </Field>
      {text("industry", "Industry")}
      {text("contactName", "Main contact")}
      {text("email", "Email", "email")}
      {text("phone", "Phone", "tel")}
      {text("website", "Website")}
      <div className="wide">{text("address", "Address")}</div>
      <div className="wide">
        <span className="field-label">Services</span>
        <div className="chips" role="group" aria-label="Services">
          {SERVICES.map((s) => (
            <button type="button" key={s} className={f.services.includes(s) ? "on" : ""} onClick={() => setF({ ...f, services: f.services.includes(s) ? f.services.filter((x) => x !== s) : [...f.services, s] })}>{s}</button>
          ))}
        </div>
      </div>
      <Field label="Monthly fee (R)">
        <input type="number" min={0} step="0.01" inputMode="decimal" value={f.monthlyFee} onChange={(e) => setF({ ...f, monthlyFee: e.target.value })} />
      </Field>
      <span />
      {text("contractStart", "Contract starts", "date")}
      {text("contractEnd", "Contract ends", "date")}
      <div className="wide">
        <Field label="Notes">
          <textarea rows={4} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
      <div className="wide row-actions">
        <Btn type="submit" busy={save.busy}>Save details</Btn>
      </div>
      <div className="wide"><ErrorNote message={save.error} /></div>
    </form>
  );
}

type Onboarding = { started: string | null; total: number; done: number; remaining: { id: string; title: string; dueDate: string | null }[]; questionnaireId: string | null; questions: string[] };

function OnboardingCard({ client, base, onChanged }: { client: AdminClient; base: string; onChanged: () => Promise<void> }) {
  const data = useLoad<Onboarding>(`/api/admin/onboarding/${client.id}`);
  const [recurring, setRecurring] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  if (!data.data) return null;
  const o = data.data;
  const hasFee = client.profile?.monthlyFee != null;
  const finished = !!o.started && o.total > 0 && o.done === o.total;
  if (!o.started && client.status !== "ONBOARDING") return null; // established clients don't need a nudge
  if (o.started && client.status !== "ONBOARDING" && finished) return null;

  const act = async (fn: () => Promise<unknown>, fail: string) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await onChanged();
      await data.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : fail);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    const text = o.questions.map((q, i) => `${i + 1}. ${q}`).join("\n\n");
    try {
      await navigator.clipboard.writeText(`Hi, to get started we would love your answers to these questions:\n\n${text}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setErr("Couldn't copy. Open the questionnaire note and copy it from there.");
    }
  };

  return (
    <section className="card glass ov-card ov-wide" aria-labelledby="h-onb">
      <header>
        <h2 id="h-onb">Onboarding</h2>
        {o.started ? <span className="muted small">{o.done} of {o.total} done</span> : null}
      </header>
      {!o.started ? (
        <>
          <p className="muted">Create the standard first weeks in one click: {o.total || 13} dated to-dos (welcome, agreement, logo and brand-asset requests, account access, kick-off, research, first audit and content plan), a discovery questionnaire and a kick-off meeting.</p>
          <label className="ob-opt">
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
            <span>
              Also set up the repeat work: a monthly report, weekly content planning{hasFee ? " and the monthly retainer invoice" : ""}.
              {!hasFee ? <span className="muted small"> Add the monthly fee under Edit details to include the retainer invoice.</span> : null}
            </span>
          </label>
          <div className="ob-actions">
            <Btn busy={busy} onClick={() => act(() => api.post(`/api/admin/onboarding/${client.id}`, { recurring }), "Couldn't start onboarding")}>Start onboarding</Btn>
          </div>
        </>
      ) : finished ? (
        <>
          <p>Everything on the onboarding checklist is done.</p>
          <div className="ob-actions">
            <Btn busy={busy} onClick={() => act(() => api.patch(`/api/admin/clients/${client.id}`, { status: "ACTIVE" }), "Couldn't update the client")}>Mark client as active</Btn>
          </div>
        </>
      ) : (
        <>
          <div className="ob-bar" role="progressbar" aria-valuemin={0} aria-valuemax={o.total} aria-valuenow={o.done} aria-label="Onboarding progress"><span style={{ width: `${(o.done / Math.max(1, o.total)) * 100}%` }} /></div>
          <ul className="rows plain">
            {o.remaining.map((t) => (
              <li key={t.id}><Link to="/admin/tasks">{t.title}</Link><span className="muted small">{t.dueDate ? fmtDate(t.dueDate) : ""}</span></li>
            ))}
          </ul>
          <div className="ob-actions">
            <Btn kind="quiet" onClick={copy}>{copied ? "Copied" : "Copy questionnaire"}</Btn>
            {o.questionnaireId ? <Link className="btn btn-quiet" to={`${base}/meetings?open=${o.questionnaireId}`}>Open questionnaire note</Link> : null}
          </div>
        </>
      )}
      <ErrorNote message={err} />
    </section>
  );
}

function Card({ title, to, children, empty }: { title: string; to?: string; children?: React.ReactNode; empty?: string }) {
  return (
    <section className="card glass ov-card">
      <header>
        <h2>{title}</h2>
        {to ? <Link className="pill" to={to}>Open</Link> : null}
      </header>
      {children ?? <p className="muted">{empty}</p>}
    </section>
  );
}

export function HomePage() {
  const { home, base, reloadHome, slug } = usePortal();
  const mods = useModules();
  const clients = useLoad<AdminClient[]>("/api/admin/clients");
  const get = (m: string) => `/api/admin/records/${m}?client=${slug}`;
  const projects = useLoad<RecordRow[]>(get("projects"));
  const finance = useLoad<RecordRow[]>(get("finance"));
  const notices = useLoad<RecordRow[]>(get("notices"));
  const meetings = useLoad<RecordRow[]>(get("meetings"));
  const websites = useLoad<RecordRow[]>(get("websites"));
  const audits = useLoad<RecordRow[]>(get("audits"));
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [editing, setEditing] = useState(false);
  const client = clients.data?.find((c) => c.slug === slug);
  if (!mods || clients.loading || projects.loading || finance.loading) return <Loading />;
  const M = (k: string) => mods.find((m) => m.key === k) as ModuleDef;
  const rows = (l: { data: RecordRow[] | null }) => l.data ?? [];
  const activeProjects = rows(projects).filter((r) => r.status === "ACTIVE" || r.status === "PLANNING");
  const outstanding = rows(finance).filter((r) => r.status === "SENT" || r.status === "OVERDUE");
  const owed = outstanding.reduce((a, r) => a + (r.amount ?? 0), 0);
  const openTasks = tasks ?? home.openTasks;
  const upcomingMeetings = rows(meetings).filter((r) => r.status === "SCHEDULED").slice(0, 3);
  const live = rows(notices).filter((n) => !n.date || n.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => Number(!!b.data.pinned) - Number(!!a.data.pinned));
  const p: ClientProfile = client?.profile ?? {};

  return (
    <>
      <PageHead
        title={home.client.name}
        lead={`${activeProjects.length} ${plural(activeProjects.length, "project", "projects")} in progress, ${openTasks.length} open ${plural(openTasks.length, "to-do", "to-dos")}${owed ? `, ${money(owed)} outstanding` : ""}.`}
        actions={client ? <Btn kind="quiet" onClick={() => setEditing(true)}>Edit details</Btn> : null}
      />
      <div className="ov-grid">
        {client ? <OnboardingCard client={client} base={base} onChanged={async () => { await clients.reload(); await reloadHome(); }} /> : null}
        <Card title="Client details">
          {client ? (
            <dl className="facts">
              <div><dt>Status</dt><dd>{CLIENT_STATUS[client.status]}</dd></div>
              {p.industry ? <div><dt>Industry</dt><dd>{p.industry}</dd></div> : null}
              {p.contactName ? <div><dt>Contact</dt><dd>{p.contactName}</dd></div> : null}
              {p.email ? <div><dt>Email</dt><dd>{p.email}</dd></div> : null}
              {p.phone ? <div><dt>Phone</dt><dd>{p.phone}</dd></div> : null}
              {p.services?.length ? <div><dt>Services</dt><dd>{p.services.join(", ")}</dd></div> : null}
              {p.monthlyFee != null ? <div><dt>Monthly fee</dt><dd>{money(p.monthlyFee)}</dd></div> : null}
              {p.contractStart || p.contractEnd ? <div><dt>Contract</dt><dd>{[fmtDate(p.contractStart), fmtDate(p.contractEnd)].filter(Boolean).join(" to ")}</dd></div> : null}
            </dl>
          ) : null}
          {client && !p.contactName && !p.email && !p.services?.length ? <p className="muted">No contact or contract details yet. Use Edit details.</p> : null}
        </Card>

        <Card title="Projects" to={`${base}/projects`} empty="No projects yet.">
          {activeProjects.length ? (
            <ul className="rows plain">
              {activeProjects.slice(0, 5).map((r) => (
                <li key={r.id}><Link to={`${base}/projects?open=${r.id}`}>{r.title}</Link><Tone m={M("projects")} status={r.status} /></li>
              ))}
            </ul>
          ) : undefined}
        </Card>

        <Card title="To-dos" to={`${base}/tasks`} empty="Nothing open. Nice.">
          {openTasks.length ? (
            <ul className="todo">
              {openTasks.slice(0, 5).map((t) => (
                <TaskRow key={t.id} task={t} onChange={() => { void reloadHome(); setTasks(null); }} />
              ))}
            </ul>
          ) : undefined}
        </Card>

        <Card title="Money" to={`${base}/finance`} empty="No invoices or quotes yet.">
          {rows(finance).length ? (
            <ul className="rows plain">
              <li><span>Outstanding</span><strong>{money(owed)}</strong></li>
              <li><span>Overdue</span><strong className={outstanding.some((r) => r.overdue) ? "late" : ""}>{money(outstanding.filter((r) => r.overdue).reduce((a, r) => a + (r.amount ?? 0), 0))}</strong></li>
              <li><span>Paid</span><strong>{money(rows(finance).filter((r) => r.status === "PAID").reduce((a, r) => a + (r.amount ?? 0), 0))}</strong></li>
            </ul>
          ) : undefined}
        </Card>

        <Card title="Meetings" to={`${base}/meetings`} empty="No upcoming meetings.">
          {upcomingMeetings.length ? (
            <ul className="rows plain">
              {upcomingMeetings.map((r) => (
                <li key={r.id}><Link to={`${base}/meetings?open=${r.id}`}>{r.title}</Link><span className="muted">{fmtDate(r.date)}</span></li>
              ))}
            </ul>
          ) : undefined}
        </Card>

        <Card title="Website and audits" to={`${base}/websites`} empty="No website or audit recorded yet.">
          {rows(websites).length || rows(audits).length ? (
            <ul className="rows plain">
              {rows(websites).slice(0, 2).map((r) => (
                <li key={r.id}><Link to={`${base}/websites?open=${r.id}`}>{r.title}</Link><span className={r.overdue ? "late" : "muted"}>{r.date ? `Renews ${fmtDate(r.date)}` : "No renewal date"}</span></li>
              ))}
              {rows(audits).slice(0, 2).map((r) => (
                <li key={r.id}><Link to={`${base}/audits?open=${r.id}`}>{r.title}</Link><span className="muted">{r.data.overall != null ? `${r.data.overall}/10` : "Not scored"}</span></li>
              ))}
            </ul>
          ) : undefined}
        </Card>

        <Card title="Notices" to={`${base}/notices`} empty="No notices.">
          {live.length ? (
            <ul className="rows plain">
              {live.slice(0, 4).map((n) => (
                <li key={n.id}><span>{n.data.pinned ? "Pinned: " : ""}{n.title}</span></li>
              ))}
            </ul>
          ) : undefined}
        </Card>
      </div>
      {editing && client ? (
        <Drawer title="Client details" onClose={() => setEditing(false)}>
          <DetailsForm client={client} onDone={async () => void (await clients.reload())} onClose={() => setEditing(false)} />
        </Drawer>
      ) : null}
    </>
  );
}
