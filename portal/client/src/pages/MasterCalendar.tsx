import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Btn, Drawer, Empty, ErrorNote, Field, Loading, PageHead, StatusChip } from "../components/ui";
import { NewPost, PostDetail, STATUSES } from "../components/PostForms";
import { fmtShort, plural, todayIso } from "../format";
import { useLoad, useMedia } from "../hooks";
import { AdminClient, MasterPost, STATUS_LABEL } from "../types";
import { MONTH_NAMES, WEEKDAYS, monthGrid } from "./Calendar";

// One colour per client. Chosen to stay distinct from each other and from the brand olive.
const CLIENT_COLOURS = ["#2f6b9a", "#b5542c", "#6b4c9a", "#2f8a6b", "#c2802b", "#9a2f5a", "#4c6b2f", "#2f8a8a", "#7a5c3a", "#5a5a8a"];

export function MasterCalendarPage() {
  const posts = useLoad<MasterPost[]>("/api/admin/posts");
  const clients = useLoad<AdminClient[]>("/api/admin/clients");
  const wide = useMedia("(min-width: 900px)");
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [view, setView] = useState<"month" | "list">("month");
  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newFor, setNewFor] = useState("");

  useEffect(() => {
    if (!wide) setView("list");
  }, [wide]);

  const colourOf = useMemo(() => {
    const map = new Map<string, string>();
    (clients.data ?? []).forEach((c, i) => map.set(c.id, CLIENT_COLOURS[i % CLIENT_COLOURS.length]));
    return map;
  }, [clients.data]);

  const visible = useMemo(
    () => (posts.data ?? []).filter((p) => (!clientFilter || p.clientId === clientFilter) && (!statusFilter || p.status === statusFilter)),
    [posts.data, clientFilter, statusFilter],
  );
  const byDate = useMemo(() => {
    const m = new Map<string, MasterPost[]>();
    for (const p of visible) m.set(p.publishDate, [...(m.get(p.publishDate) ?? []), p]);
    return m;
  }, [visible]);

  if (posts.loading || clients.loading) return <Loading />;
  if (!posts.data || !clients.data) return <ErrorNote message={posts.error ?? clients.error} />;

  const activeClients = clients.data.filter((c) => c.status !== "ARCHIVED");
  const refresh = async () => {
    await posts.reload();
    await clients.reload();
  };
  const open = posts.data.find((p) => p.id === openId) ?? null;
  const today = todayIso();
  const monthPrefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`;
  const monthPosts = visible.filter((p) => p.publishDate.startsWith(monthPrefix));
  const listPosts = view === "list" ? visible : monthPosts;
  const go = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const monthClients = new Set(monthPosts.map((p) => p.clientId)).size;
  const chosenNew = newFor || activeClients[0]?.id || "";
  const newSlug = activeClients.find((c) => c.id === chosenNew)?.slug ?? "";

  const style = (id: string) => ({ ["--c" as string]: colourOf.get(id) ?? "#66634f" });

  return (
    <>
      <PageHead
        title="Content calendar"
        lead={
          monthPosts.length === 0
            ? "Nothing planned this month for the clients shown."
            : `${monthPosts.length} ${plural(monthPosts.length, "post", "posts")} in ${MONTH_NAMES[cursor.m]} across ${monthClients} ${plural(monthClients, "client", "clients")}.`
        }
        actions={
          <>
            {wide ? (
              <div className="seg" role="group" aria-label="View">
                <button className={view === "month" ? "active" : ""} onClick={() => setView("month")}>
                  Month
                </button>
                <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
                  List
                </button>
              </div>
            ) : null}
            <Btn onClick={() => setCreating(true)} disabled={activeClients.length === 0}>
              New post
            </Btn>
          </>
        }
      />

      <div className="filters">
        <Field label="Client">
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
            <option value="">All clients</option>
            {activeClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <ul className="legend" aria-label="Client colours">
          {activeClients.map((c) => (
            <li key={c.id}>
              <button className={clientFilter === c.id ? "active" : ""} onClick={() => setClientFilter(clientFilter === c.id ? "" : c.id)} style={style(c.id)}>
                <span className="dot" />
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {activeClients.length === 0 ? (
        <Empty action={<Link className="text-link" to="/admin">Add a client first</Link>}>There are no clients yet, so there is nothing to plan.</Empty>
      ) : view === "month" && wide ? (
        <>
          <div className="cal-nav">
            <Btn kind="quiet" onClick={() => go(-1)}>
              Previous
            </Btn>
            <h2>
              {MONTH_NAMES[cursor.m]} {cursor.y}
            </h2>
            <Btn kind="quiet" onClick={() => go(1)}>
              Next
            </Btn>
          </div>
          <div className="cal" role="grid" aria-label={`${MONTH_NAMES[cursor.m]} ${cursor.y}`}>
            {WEEKDAYS.map((d) => (
              <div key={d} className="cal-dow" role="columnheader">
                {d}
              </div>
            ))}
            {monthGrid(cursor.y, cursor.m).map((d, i) => (
              <div key={i} className={`cal-day ${d ? "" : "blank"} ${d === today ? "today" : ""}`} role="gridcell">
                {d ? <span className="cal-num">{Number(d.slice(8))}</span> : null}
                {d
                  ? (byDate.get(d) ?? []).map((p) => (
                      <button key={p.id} className="cal-post by-client" style={style(p.clientId)} onClick={() => setOpenId(p.id)} title={`${p.clientName}: ${p.platform}, ${STATUS_LABEL[p.status]}`}>
                        <span className="cal-post-plat">{p.clientName}</span>
                        <span className="cal-post-state">
                          {p.platform} · {STATUS_LABEL[p.status]}
                        </span>
                      </button>
                    ))
                  : null}
              </div>
            ))}
          </div>
        </>
      ) : listPosts.length === 0 ? (
        <Empty>No posts match these filters.</Empty>
      ) : (
        <ul className="post-list">
          {listPosts.map((p) => (
            <li key={p.id}>
              <button onClick={() => setOpenId(p.id)} style={style(p.clientId)}>
                <span className="post-date">{fmtShort(p.publishDate)}</span>
                <span className="post-main">
                  <strong>
                    <span className="dot" /> {p.clientName}
                  </strong>
                  <span className="muted">
                    {p.platform}
                    {p.caption ? `: ${p.caption.slice(0, 70)}` : ""}
                  </span>
                </span>
                <StatusChip status={p.status} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <Drawer title={`${open.clientName}, ${fmtShort(open.publishDate)}`} onClose={() => setOpenId(null)}>
          <PostDetail post={open} slug={open.clientSlug} isAdmin onDone={refresh} onClose={() => setOpenId(null)} />
        </Drawer>
      ) : null}
      {creating ? (
        <Drawer title="New post" onClose={() => setCreating(false)}>
          <div className="drawer-form" style={{ borderTop: 0, paddingTop: 0 }}>
            <Field label="Client">
              <select value={chosenNew} onChange={(e) => setNewFor(e.target.value)}>
                {activeClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <NewPost key={newSlug} slug={newSlug} onDone={refresh} onClose={() => setCreating(false)} />
        </Drawer>
      ) : null}
    </>
  );
}
