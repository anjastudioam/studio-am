import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Btn, ConfirmDelete, Empty, ErrorNote, Field, Loading, PageHead } from "../components/ui";
import { fmtShort, todayIso } from "../format";
import { useLoad } from "../hooks";
import { money } from "../modules";
import type { AdminClient } from "../types";

type Health = "no-fee" | "no-time" | "no-target" | "ok" | "watch" | "loss";
type Summary = {
  month: string;
  target: number | null;
  totalMinutes: number;
  blendedRate: number | null;
  rows: { clientId: string; name: string; slug: string; fee: number | null; minutes: number; rate: number | null; health: Health; gap: number | null }[];
};
type Entry = { id: string; clientId: string; clientName: string; clientSlug: string; note: string; date: string; minutes: number };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const clean = (n: string) => n.replace(/\s*\(demo\)/i, "");
export const hoursOf = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};
const HEALTH: Record<Health, { label: string; cls: string }> = {
  ok: { label: "Healthy", cls: "health-ok" },
  watch: { label: "Watch", cls: "health-watch" },
  loss: { label: "Losing money", cls: "health-loss" },
  "no-target": { label: "Set a target rate", cls: "health-none" },
  "no-fee": { label: "No monthly fee set", cls: "health-none" },
  "no-time": { label: "No time logged", cls: "health-none" },
};

function shiftMonth(m: string, d: number) {
  const dt = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + d, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

export function TimePage() {
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const summary = useLoad<Summary>(`/api/admin/time/summary?month=${month}`);
  const entries = useLoad<Entry[]>(`/api/admin/time/entries?month=${month}`);
  const clients = useLoad<AdminClient[]>("/api/admin/clients");
  const [target, setTarget] = useState("");
  const [client, setClient] = useState("");
  const [date, setDate] = useState(todayIso());
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<{ id: string; hours: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const again = () => {
      void summary.reload();
      void entries.reload();
    };
    window.addEventListener("sam:time-changed", again);
    return () => window.removeEventListener("sam:time-changed", again);
  });
  useEffect(() => {
    if (summary.data) setTarget(summary.data.target ? String(summary.data.target) : "");
  }, [summary.data?.target]); // eslint-disable-line react-hooks/exhaustive-deps

  if (summary.loading || entries.loading || clients.loading) return <Loading />;
  if (!summary.data || !entries.data) return <ErrorNote message={summary.error ?? entries.error} />;
  const sum = summary.data;
  const active = (clients.data ?? []).filter((c) => c.status !== "ARCHIVED");
  const chosen = client || active[0]?.id || "";
  const [y, m] = month.split("-").map(Number);
  const reload = async () => {
    await summary.reload();
    await entries.reload();
  };
  const run = async (fn: () => Promise<unknown>, fail: string) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : fail);
    } finally {
      setBusy(false);
    }
  };
  const toMinutes = (h: string) => Math.round(parseFloat(h.replace(",", ".")) * 60);

  const saveTarget = (e: FormEvent) => {
    e.preventDefault();
    void run(() => api.put("/api/admin/time/target", { rate: target.trim() ? Number(target) : null }), "Couldn't save the rate");
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    const minutes = toMinutes(hours);
    if (!minutes || minutes < 1) return setErr("Enter the hours worked, for example 1.5");
    void run(async () => {
      await api.post("/api/admin/time/entries", { clientId: chosen, date, minutes, ...(note.trim() ? { note: note.trim() } : {}) });
      setHours("");
      setNote("");
    }, "Couldn't save that time");
  };

  const losing = sum.rows.filter((r) => r.health === "loss");
  const lead =
    sum.totalMinutes === 0
      ? "Nothing logged this month. Start a timer from the top bar or add time below."
      : losing.length
        ? `${losing.length} ${losing.length === 1 ? "retainer is" : "retainers are"} earning less than your target per hour.`
        : "Hours logged this month, against what each retainer pays.";

  return (
    <div className="panel">
      <PageHead title="Time tracking" lead={lead} />
      <div className="month-nav">
        <Btn kind="quiet" onClick={() => setMonth(shiftMonth(month, -1))}>Previous</Btn>
        <h2>{MONTHS[m - 1]} {y}</h2>
        <Btn kind="quiet" onClick={() => setMonth(shiftMonth(month, 1))}>Next</Btn>
      </div>

      <div className="time-tiles">
        <div className="time-tile"><span className="muted small">Hours logged</span><b>{hoursOf(sum.totalMinutes)}</b></div>
        <div className="time-tile"><span className="muted small">Average per hour</span><b>{sum.blendedRate ? money(sum.blendedRate) : "None yet"}</b></div>
        <form className="time-tile rate-form" onSubmit={saveTarget}>
          <Field label="Your target rate per hour (R)">
            <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 600" />
          </Field>
          <Btn type="submit" kind="quiet" busy={busy}>Save</Btn>
        </form>
      </div>

      <h2 className="section-h">Retainers</h2>
      {sum.rows.length === 0 ? (
        <Empty>No retainers or time yet. Add a monthly fee to a client and log some time to see what each hour earns.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th><th>Monthly fee</th><th>Hours</th><th>Earned per hour</th><th>Against target</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sum.rows.map((r) => (
                <tr key={r.clientId}>
                  <td data-label="Client"><Link className="text-link" to={`/c/${r.slug}`}>{clean(r.name)}</Link></td>
                  <td data-label="Monthly fee">{r.fee ? money(r.fee) : <span className="muted">Not set</span>}</td>
                  <td data-label="Hours">{hoursOf(r.minutes)}</td>
                  <td data-label="Earned per hour">{r.rate ? money(r.rate) : <span className="muted">None</span>}</td>
                  <td data-label="Against target">
                    {r.gap == null ? <span className="muted">None</span> : <span className={r.gap < 0 ? "late" : ""}>{r.gap < 0 ? "-" : "+"}{money(Math.abs(r.gap))}</span>}
                  </td>
                  <td data-label="Status"><span className={`health ${HEALTH[r.health].cls}`}>{HEALTH[r.health].label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">Earned per hour is the monthly fee divided by the hours logged. Against target compares the fee with what those hours would earn at your target rate.</p>

      <h2 className="section-h" style={{ marginTop: "2rem" }}>Time log</h2>
      <form className="time-add" onSubmit={add}>
        <Field label="Client">
          <select value={chosen} onChange={(e) => setClient(e.target.value)}>
            {active.map((c) => <option key={c.id} value={c.id}>{clean(c.name)}</option>)}
          </select>
        </Field>
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Hours"><input inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="1.5" required /></Field>
        <Field label="What you did"><input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field>
        <Btn type="submit" busy={busy} disabled={!chosen}>Add time</Btn>
      </form>
      <ErrorNote message={err} />
      {entries.data.length === 0 ? (
        <Empty>No time logged in {MONTHS[m - 1]}.</Empty>
      ) : (
        <ul className="rows time-log">
          {entries.data.map((e) => (
            <li key={e.id}>
              <span className="time-main">
                <strong>{clean(e.clientName)}</strong>
                <span className="muted small">{fmtShort(e.date)}{e.note ? ` · ${e.note}` : ""}</span>
              </span>
              {editing?.id === e.id ? (
                <>
                  <input inputMode="decimal" aria-label="Hours" value={editing.hours} onChange={(ev) => setEditing({ id: e.id, hours: ev.target.value })} />
                  <Btn onClick={() => run(async () => { await api.patch(`/api/admin/time/entries/${e.id}`, { minutes: toMinutes(editing.hours) }); setEditing(null); }, "Couldn't save that")}>Save</Btn>
                  <Btn kind="quiet" onClick={() => setEditing(null)}>Cancel</Btn>
                </>
              ) : (
                <>
                  <strong>{hoursOf(e.minutes)}</strong>
                  <Btn kind="quiet" onClick={() => setEditing({ id: e.id, hours: String(Math.round((e.minutes / 60) * 100) / 100) })}>Edit</Btn>
                  <ConfirmDelete onConfirm={() => run(() => api.del(`/api/admin/time/entries/${e.id}`), "Couldn't delete that")} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
