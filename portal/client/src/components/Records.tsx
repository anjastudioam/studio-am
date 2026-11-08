import { Fragment, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { fmtDate, hostOf, todayIso } from "../format";
import { useAction, useLoad } from "../hooks";
import { FieldDef, ModuleDef, RecordRow, money, stripUnit, useModules } from "../modules";
import type { AdminClient } from "../types";
import { Btn, ConfirmDelete, Drawer, Empty, ErrorNote, Field, Loading, PageHead } from "./ui";

/* ---------- small pieces ---------- */

export function Tone({ m, status }: { m: ModuleDef; status: string | null }) {
  const s = m.statuses?.find((x) => x.key === status);
  if (!s) return null;
  return <span className={`tone tone-${s.tone}`}>{s.label}</span>;
}

function Cell({ m, r, col }: { m: ModuleDef; r: RecordRow; col: string }): ReactNode {
  if (col === "client") return r.clientSlug ? <Link className="text-link" to={`/c/${r.clientSlug}`}>{r.clientName}</Link> : <span className="muted">Agency</span>;
  if (col === "status") return <Tone m={m} status={r.status} />;
  if (col === "date") return r.date ? <span className={r.overdue ? "late" : ""}>{fmtDate(r.date)}{r.overdue ? " (late)" : ""}</span> : <span className="muted">None</span>;
  if (col === "amount") return r.amount == null ? <span className="muted">None</span> : money(r.amount);
  if (col === "overall") return r.data.overall == null ? <span className="muted">Not scored</span> : <strong>{r.data.overall}/{m.scores?.max ?? 10}</strong>;
  const v = r.data[col];
  const f = m.fields.find((x) => x.key === col);
  if (v == null || v === "" || (Array.isArray(v) && !v.length)) return <span className="muted">None</span>;
  if (f?.type === "url") return <a className="text-link" href={v} target="_blank" rel="noopener noreferrer">{hostOf(v)}</a>;
  if (f?.type === "tags") return <span className="taglist">{(v as string[]).map((t) => <span key={t} className="tag">{t}</span>)}</span>;
  if (f?.type === "checkbox") return v ? "Pinned" : "";
  if (f?.type === "number" && col === "followers") return Number(v).toLocaleString("en-ZA").replace(/,/g, " ");
  return String(v);
}

function headerOf(m: ModuleDef, col: string) {
  if (col === "client") return "Client";
  if (col === "status") return "Status";
  if (col === "date") return m.dateLabel ?? "Date";
  if (col === "amount") return stripUnit(m.amountLabel ?? "Amount");
  if (col === "overall") return "Overall score";
  return stripUnit(m.fields.find((f) => f.key === col)?.label ?? col);
}

/* ---------- form ---------- */

type Form = { title: string; clientId: string; status: string; date: string; amount: string; data: Record<string, any> };

function blank(m: ModuleDef, clientId: string): Form {
  return { title: "", clientId, status: m.statuses?.[0]?.key ?? "", date: "", amount: "", data: {} };
}
function fromRecord(r: RecordRow): Form {
  return { title: r.title, clientId: r.clientId ?? "", status: r.status ?? "", date: r.date ?? "", amount: r.amount == null ? "" : String(r.amount), data: { ...r.data } };
}

function FieldInput({ f, value, onChange }: { f: FieldDef; value: any; onChange: (v: any) => void }) {
  const common = { required: f.required };
  let input: ReactNode;
  switch (f.type) {
    case "longtext":
      input = <textarea rows={4} {...common} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "select":
      input = (
        <select {...common} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Not set</option>
          {f.options!.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
      break;
    case "number":
    case "rating":
      input = <input type="number" inputMode="decimal" min={0} max={f.type === "rating" ? f.max ?? 10 : undefined} step={f.type === "rating" ? ((f.max ?? 10) <= 5 ? 1 : 0.5) : "any"} {...common} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "date":
      input = <input type="date" {...common} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "url":
      input = <input type="url" placeholder="https://" {...common} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "checkbox":
      return (
        <label className="check">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <span>{f.label}</span>
        </label>
      );
    case "tags":
      input = <input {...common} placeholder="Separate with commas" value={Array.isArray(value) ? value.join(", ") : value ?? ""} onChange={(e) => onChange(e.target.value)} />;
      break;
    default:
      input = <input {...common} maxLength={300} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <div className={f.wide ? "wide" : ""}>
      <Field label={f.label + (f.required ? " *" : "")} hint={f.hint}>
        {input}
      </Field>
    </div>
  );
}

function toPayload(m: ModuleDef, f: Form, editing: boolean) {
  const none = editing ? null : undefined;
  const data: Record<string, any> = {};
  for (const fd of m.fields) {
    let v = f.data[fd.key];
    if (fd.type === "checkbox") {
      if (editing || v) data[fd.key] = !!v;
      continue;
    }
    if (v === "" || v == null || (Array.isArray(v) && !v.length)) {
      if (editing) data[fd.key] = null;
      continue;
    }
    if (fd.type === "number" || fd.type === "rating") v = Number(v);
    if (fd.type === "tags") v = (Array.isArray(v) ? v : String(v).split(",")).map((t: string) => t.trim()).filter(Boolean);
    data[fd.key] = v;
  }
  return {
    title: f.title.trim(),
    clientId: f.clientId || none,
    ...(m.statuses ? { status: f.status || undefined } : {}),
    date: f.date || none,
    amount: f.amount === "" ? none : Number(f.amount),
    data,
  };
}

function AuditReport({ r }: { r: RecordRow }) {
  const scores = ["scoreStrategy", "scoreConsistency", "scoreQuality", "scoreEngagement", "scoreTechnical", "scoreConversion"].filter((k) => typeof r.data[k] === "number");
  const label = (k: string) => k.replace("score", "");
  const sec = (k: string, t: string) => (r.data[k] ? <section><h3>{t}</h3><p className="prewrap">{r.data[k]}</p></section> : null);
  return (
    <div className="report">
      <p className="muted">{r.clientName} · {r.data.auditType} audit · {fmtDate(r.date) || "No date"}</p>
      {r.data.overall != null ? <p className="report-score">Overall <strong>{r.data.overall}</strong> / 10</p> : null}
      {scores.length ? (
        <ul className="bars">
          {scores.map((k) => (
            <li key={k} className="bar-row"><span>{label(k)}</span><div className="bar"><i style={{ width: `${r.data[k] * 10}%` }} /></div><b>{r.data[k]}</b></li>
          ))}
        </ul>
      ) : null}
      {sec("summary", "Executive summary")}
      {sec("strengths", "Strengths")}
      {sec("weaknesses", "Weaknesses and gaps")}
      {sec("opportunities", "Opportunities")}
      {sec("recommendations", "Recommendations")}
      <div className="row-actions no-print"><Btn onClick={() => window.print()}>Print or save as PDF</Btn></div>
    </div>
  );
}

function RecordDrawer({ m, record, clients, defaultClient, onSaved, onClose }: { m: ModuleDef; record: RecordRow | null; clients: AdminClient[]; defaultClient: string; onSaved: () => Promise<void>; onClose: () => void }) {
  const [f, setF] = useState<Form>(record ? fromRecord(record) : blank(m, defaultClient));
  const [report, setReport] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const save = useAction();
  const act = useAction();
  const del = useAction();
  const set = (patch: Partial<Form>) => setF({ ...f, ...patch });
  const clientLocked = !!defaultClient && !record;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = toPayload(m, f, !!record);
    const res = await save.run(() => (record ? api.patch(`/api/admin/records/${m.key}/${record.id}`, body) : api.post(`/api/admin/records/${m.key}`, body)));
    if (res) {
      await onSaved();
      onClose();
    }
  };
  const run = (key: string) =>
    act.run(async () => {
      const res = await api.post<{ message: string; clientSlug?: string }>(`/api/admin/records/${m.key}/${record!.id}/actions/${key}`, f.clientId && !record!.clientId ? { clientId: f.clientId } : {});
      setNote(res.message);
      await onSaved();
    });

  return (
    <Drawer title={record ? record.title : `New ${m.singular}`} onClose={onClose}>
      {record && m.key === "audits" ? (
        <div className="seg">
          <button className={!report ? "on" : ""} onClick={() => setReport(false)}>Edit</button>
          <button className={report ? "on" : ""} onClick={() => setReport(true)}>Report view</button>
        </div>
      ) : null}
      {report && record ? (
        <AuditReport r={record} />
      ) : (
        <form className="drawer-form rec-form" onSubmit={submit}>
          <div className="wide">
            <Field label={m.titleLabel + " *"}>
              <input required maxLength={200} value={f.title} onChange={(e) => set({ title: e.target.value })} autoFocus />
            </Field>
          </div>
          <Field label={m.client === "required" ? "Client *" : "Client"} hint={m.client === "optional" ? "Leave empty for the whole agency." : undefined}>
            <select required={m.client === "required"} value={f.clientId} onChange={(e) => set({ clientId: e.target.value })} disabled={clientLocked}>
              <option value="">{m.client === "required" ? "Choose a client" : "Agency (no client)"}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          {m.statuses ? (
            <Field label="Status">
              <select value={f.status} onChange={(e) => set({ status: e.target.value })}>
                {m.statuses.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </Field>
          ) : null}
          {m.dateLabel ? (
            <Field label={m.dateLabel}>
              <input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
          ) : null}
          {m.amountLabel ? (
            <Field label={m.amountLabel + (m.amountRequired ? " *" : "")}>
              <input type="number" inputMode="decimal" min={0} step="0.01" required={m.amountRequired} value={f.amount} onChange={(e) => set({ amount: e.target.value })} />
            </Field>
          ) : null}
          {m.fields.map((fd, i) => (
            <Fragment key={fd.key}>
              {fd.group && fd.group !== m.fields[i - 1]?.group ? <h3 className="form-group wide">{fd.group}</h3> : null}
              <FieldInput f={fd} value={f.data[fd.key]} onChange={(v) => set({ data: { ...f.data, [fd.key]: v } })} />
            </Fragment>
          ))}
          <div className="wide row-actions">
            <Btn type="submit" busy={save.busy}>{record ? "Save changes" : `Add ${m.singular}`}</Btn>
            {record ? <ConfirmDelete label="Delete" onConfirm={async () => { await del.run(() => api.del(`/api/admin/records/${m.key}/${record.id}`)); await onSaved(); onClose(); }} /> : null}
          </div>
          <div className="wide"><ErrorNote message={save.error ?? del.error} /></div>
        </form>
      )}
      {record && m.actions?.length && !report ? (
        <section className="rec-actions">
          <h3>Next steps</h3>
          <div className="row-actions">
            {m.actions.map((a) => (
              <Btn key={a.key} kind="quiet" busy={act.busy} onClick={() => run(a.key)}>{a.label}</Btn>
            ))}
          </div>
          {m.client === "optional" && !record.clientId && m.key !== "leads" ? <p className="muted small">Choose a client above first, then save or run the step.</p> : null}
          {note ? <p className="ok-note" role="status">{note}</p> : null}
          <ErrorNote message={act.error} />
        </section>
      ) : null}
    </Drawer>
  );
}

/* ---------- the page ---------- */

export function RecordsView({ module, clientSlug, embedded }: { module: string; clientSlug?: string; embedded?: boolean }) {
  const mods = useModules();
  const m = mods?.find((x) => x.key === module) ?? null;
  const qs = clientSlug ? `?client=${encodeURIComponent(clientSlug)}` : "";
  const list = useLoad<RecordRow[]>(m ? `/api/admin/records/${module}${qs}` : null);
  const summary = useLoad<{ tiles: { label: string; kind: "count" | "amount"; value: number }[] }>(m?.summary ? `/api/admin/records/${module}/summary` : null);
  const clients = useLoad<AdminClient[]>("/api/admin/clients");
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<"list" | "board">("list");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const move = useAction();

  useEffect(() => {
    const o = params.get("open");
    if (o) setOpenId(o);
    if (params.get("new") === "1") setCreating(true);
  }, [params]);

  useEffect(() => {
    if (m?.board) setView((v) => v);
  }, [m]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (list.data ?? []).filter((r) => {
      if (status && r.status !== status) return false;
      if (clientFilter && (clientFilter === "__agency" ? r.clientId : r.clientId !== clientFilter)) return false;
      if (!needle) return true;
      return (r.title + " " + (r.clientName ?? "") + " " + JSON.stringify(r.data)).toLowerCase().includes(needle);
    });
  }, [list.data, status, q, clientFilter]);

  if (!m || list.loading || clients.loading) return <Loading />;
  const open = list.data?.find((r) => r.id === openId) ?? null;
  const defaultClient = clientSlug ? clients.data?.find((c) => c.slug === clientSlug)?.id ?? "" : "";
  const closeAll = () => {
    setOpenId(null);
    setCreating(false);
    if (params.has("open") || params.has("new")) setParams({}, { replace: true });
  };
  const refresh = async () => {
    await Promise.all([list.reload(), summary.reload?.()]);
  };
  const activeClients = (clients.data ?? []).filter((c) => c.status !== "ARCHIVED");

  const body = (
    <>
      {summary.data?.tiles.length ? (
        <div className="rec-tiles">
          {summary.data.tiles.map((t) => (
            <div key={t.label} className="rec-tile glass">
              <span>{t.label}</span>
              <strong>{t.kind === "amount" ? money(t.value) : t.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      <div className="rec-filters">
        <input type="search" placeholder={`Search ${m.label.toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        {!clientSlug ? (
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} aria-label="Client">
            <option value="">All clients</option>
            {m.client === "optional" ? <option value="__agency">Agency only</option> : null}
            {activeClients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : null}
        {m.statuses ? (
          <div className="chips" role="group" aria-label="Status">
            <button className={!status ? "on" : ""} onClick={() => setStatus("")}>All</button>
            {m.statuses.map((s) => (
              <button key={s.key} className={status === s.key ? "on" : ""} onClick={() => setStatus(status === s.key ? "" : s.key)}>{s.label}</button>
            ))}
          </div>
        ) : null}
        {m.board ? (
          <div className="seg">
            <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}>List</button>
            <button className={view === "board" ? "on" : ""} onClick={() => setView("board")}>Board</button>
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <Empty action={<Btn onClick={() => setCreating(true)}>Add {m.singular}</Btn>}>{list.data?.length ? "Nothing matches those filters." : m.empty}</Empty>
      ) : view === "board" && m.board && m.statuses ? (
        <div className="board">
          {m.statuses.map((s) => {
            const col = rows.filter((r) => r.status === s.key);
            return (
              <section key={s.key} className="board-col">
                <header><Tone m={m} status={s.key} /><span className="muted">{col.length}</span></header>
                {col.map((r) => (
                  <article key={r.id} className="board-card">
                    <button className="board-title" onClick={() => setOpenId(r.id)}>{r.title}</button>
                    <p className="muted small">
                      {[r.clientName, r.amount != null ? money(r.amount) : null, r.date ? fmtDate(r.date) : null].filter(Boolean).join(" · ")}
                    </p>
                    <select
                      aria-label={`Move ${r.title}`}
                      value={r.status ?? ""}
                      onChange={async (e) => {
                        await move.run(() => api.patch(`/api/admin/records/${m.key}/${r.id}`, { status: e.target.value }));
                        await refresh();
                      }}
                    >
                      {m.statuses!.map((x) => (
                        <option key={x.key} value={x.key}>{x.label}</option>
                      ))}
                    </select>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{m.titleLabel === "Description" ? "Description" : stripUnit(m.titleLabel)}</th>
                {m.columns.filter((c) => !(clientSlug && c === "client")).map((c) => (
                  <th key={c}>{headerOf(m, c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.status && m.open && !m.open.includes(r.status) && m.statuses ? "dim" : ""}>
                  <td data-label={stripUnit(m.titleLabel)}>
                    <button className="row-link" onClick={() => setOpenId(r.id)}>{r.title}</button>
                  </td>
                  {m.columns.filter((c) => !(clientSlug && c === "client")).map((c) => (
                    <td key={c} data-label={headerOf(m, c)}><Cell m={m} r={r} col={c} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ErrorNote message={move.error} />

      {creating || open ? (
        <RecordDrawer key={open?.id ?? "new"} m={m} record={creating ? null : open} clients={activeClients} defaultClient={defaultClient} onSaved={refresh} onClose={closeAll} />
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <>
        <div className="row-actions embedded-head">
          <Btn onClick={() => setCreating(true)}>Add {m.singular}</Btn>
        </div>
        {body}
      </>
    );
  }
  return (
    <>
      <PageHead title={m.label} lead={`${list.data?.length ?? 0} ${m.singular}${list.data?.length === 1 ? "" : "s"}${clientSlug ? "" : " across the agency"}.`} actions={<Btn onClick={() => setCreating(true)}>New {m.singular}</Btn>} />
      {body}
    </>
  );
}

export function RecordsPage({ module }: { module: string }) {
  return <RecordsView module={module} />;
}

export function ClientRecordsPage({ module, slug }: { module: string; slug: string }) {
  return <RecordsView module={module} clientSlug={slug} />;
}

export { todayIso };
