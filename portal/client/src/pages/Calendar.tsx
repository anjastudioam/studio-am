import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { usePortal } from "../components/Shell";
import { Btn, ConfirmDelete, Drawer, Empty, ErrorNote, Field, Loading, PageHead, StatusChip } from "../components/ui";
import { fmtDate, fmtDateTime, fmtShort, hostOf, todayIso } from "../format";
import { useAction, useLoad, useMedia } from "../hooks";
import { Post, PostEvent, PostStatus, STATUS_LABEL } from "../types";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATUSES = Object.keys(STATUS_LABEL) as PostStatus[];

function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

function PostDetail({ post, onDone, onClose }: { post: Post; onDone: () => Promise<void>; onClose: () => void }) {
  const { slug, isAdmin } = usePortal();
  const { data: events } = useLoad<PostEvent[]>(`/api/c/${slug}/posts/${post.id}/events`);
  const respond = useAction();
  const save = useAction();
  const [comment, setComment] = useState("");
  const [asking, setAsking] = useState(false);
  const [edit, setEdit] = useState({
    publishDate: post.publishDate,
    platform: post.platform,
    pillar: post.pillar ?? "",
    format: post.format ?? "",
    caption: post.caption,
    assetUrl: post.assetUrl ?? "",
    status: post.status,
    internalNote: post.internalNote ?? "",
  });

  const answer = async (decision: "APPROVE" | "REQUEST_CHANGES") => {
    const res = await respond.run(() => api.post(`/api/c/${slug}/posts/${post.id}/respond`, { decision, ...(comment ? { comment } : {}) }));
    if (res) {
      await onDone();
      onClose();
    }
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await save.run(() =>
      api.patch(`/api/c/${slug}/posts/${post.id}`, {
        publishDate: edit.publishDate,
        platform: edit.platform,
        pillar: edit.pillar || null,
        format: edit.format || null,
        caption: edit.caption,
        assetUrl: edit.assetUrl || null,
        status: edit.status,
        internalNote: edit.internalNote || null,
      }),
    );
    if (res) {
      await onDone();
      onClose();
    }
  };

  const awaiting = post.status === "AWAITING_APPROVAL";

  return (
    <>
      <div className="post-meta">
        <StatusChip status={post.status} />
        <span>{fmtDate(post.publishDate)}</span>
        <span>{post.platform}</span>
        {post.format ? <span>{post.format}</span> : null}
        {post.pillar ? <span>{post.pillar}</span> : null}
      </div>
      <p className="post-caption prewrap">{post.caption || "No caption yet."}</p>
      {post.assetUrl ? (
        <p>
          <a className="text-link" href={post.assetUrl} target="_blank" rel="noopener noreferrer">
            View the creative ({hostOf(post.assetUrl)})
          </a>
        </p>
      ) : null}

      {awaiting ? (
        <section className="respond">
          <h3>Your decision</h3>
          {asking ? (
            <>
              <Field label="What should change?">
                <textarea rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} autoFocus />
              </Field>
              <div className="row-actions">
                <Btn busy={respond.busy} onClick={() => answer("REQUEST_CHANGES")} disabled={!comment.trim()}>
                  Send feedback
                </Btn>
                <Btn kind="quiet" onClick={() => setAsking(false)}>
                  Back
                </Btn>
              </div>
            </>
          ) : (
            <div className="row-actions">
              <Btn busy={respond.busy} onClick={() => answer("APPROVE")}>
                Approve post
              </Btn>
              <Btn kind="quiet" onClick={() => setAsking(true)}>
                Request changes
              </Btn>
            </div>
          )}
          <ErrorNote message={respond.error} />
        </section>
      ) : null}

      {events && events.length > 0 ? (
        <section>
          <h3>History</h3>
          <ul className="history">
            {events.map((ev) => (
              <li key={ev.id}>
                <span>
                  {ev.fromStatus ? `${STATUS_LABEL[ev.fromStatus]} → ` : "Created as "}
                  {STATUS_LABEL[ev.toStatus]}
                </span>
                <span className="muted small">{fmtDateTime(ev.createdAt)}</span>
                {ev.comment ? <p className="prewrap">“{ev.comment}”</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isAdmin ? (
        <form className="drawer-form" onSubmit={submitEdit}>
          <h3>Edit post</h3>
          <Field label="Date">
            <input type="date" required value={edit.publishDate} onChange={(e) => setEdit({ ...edit, publishDate: e.target.value })} />
          </Field>
          <Field label="Platform">
            <input required value={edit.platform} onChange={(e) => setEdit({ ...edit, platform: e.target.value })} />
          </Field>
          <Field label="Format">
            <input value={edit.format} onChange={(e) => setEdit({ ...edit, format: e.target.value })} placeholder="Reel, carousel, story…" />
          </Field>
          <Field label="Theme">
            <input value={edit.pillar} onChange={(e) => setEdit({ ...edit, pillar: e.target.value })} />
          </Field>
          <Field label="Caption">
            <textarea rows={5} value={edit.caption} onChange={(e) => setEdit({ ...edit, caption: e.target.value })} />
          </Field>
          <Field label="Creative link" hint="https:// only">
            <input type="url" value={edit.assetUrl} onChange={(e) => setEdit({ ...edit, assetUrl: e.target.value })} />
          </Field>
          <Field label="Status">
            <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as PostStatus })}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Internal note" hint="Only Studio AM sees this">
            <textarea rows={2} value={edit.internalNote} onChange={(e) => setEdit({ ...edit, internalNote: e.target.value })} />
          </Field>
          <div className="row-actions">
            <Btn type="submit" busy={save.busy}>
              Save changes
            </Btn>
            <ConfirmDelete
              label="Delete post"
              onConfirm={async () => {
                await api.del(`/api/c/${slug}/posts/${post.id}`);
                await onDone();
                onClose();
              }}
            />
          </div>
          <ErrorNote message={save.error} />
        </form>
      ) : null}
    </>
  );
}

function NewPost({ onDone, onClose }: { onDone: () => Promise<void>; onClose: () => void }) {
  const { slug } = usePortal();
  const add = useAction();
  const [f, setF] = useState({ publishDate: todayIso(), platform: "Instagram", format: "", pillar: "", caption: "", assetUrl: "", status: "DRAFT" as PostStatus });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await add.run(() =>
      api.post(`/api/c/${slug}/posts`, {
        publishDate: f.publishDate,
        platform: f.platform,
        status: f.status,
        ...(f.format ? { format: f.format } : {}),
        ...(f.pillar ? { pillar: f.pillar } : {}),
        ...(f.caption ? { caption: f.caption } : {}),
        ...(f.assetUrl ? { assetUrl: f.assetUrl } : {}),
      }),
    );
    if (res) {
      await onDone();
      onClose();
    }
  };
  return (
    <form className="drawer-form" onSubmit={submit}>
      <Field label="Date">
        <input type="date" required value={f.publishDate} onChange={(e) => setF({ ...f, publishDate: e.target.value })} />
      </Field>
      <Field label="Platform">
        <input required value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} />
      </Field>
      <Field label="Format">
        <input value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })} placeholder="Reel, carousel, story…" />
      </Field>
      <Field label="Theme">
        <input value={f.pillar} onChange={(e) => setF({ ...f, pillar: e.target.value })} />
      </Field>
      <Field label="Caption">
        <textarea rows={5} value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} />
      </Field>
      <Field label="Creative link" hint="https:// only">
        <input type="url" value={f.assetUrl} onChange={(e) => setF({ ...f, assetUrl: e.target.value })} />
      </Field>
      <Field label="Status" hint="Clients can't see drafts">
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as PostStatus })}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </Field>
      <Btn type="submit" busy={add.busy}>
        Add post
      </Btn>
      <ErrorNote message={add.error} />
    </form>
  );
}

export function CalendarPage() {
  const { slug, isAdmin, reloadHome } = usePortal();
  const { data, error, loading, reload } = useLoad<Post[]>(`/api/c/${slug}/posts`);
  const wide = useMedia("(min-width: 900px)");
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<"month" | "list">("month");

  const byDate = useMemo(() => {
    const m = new Map<string, Post[]>();
    for (const p of data ?? []) m.set(p.publishDate, [...(m.get(p.publishDate) ?? []), p]);
    return m;
  }, [data]);

  useEffect(() => {
    if (!wide) setView("list");
  }, [wide]);

  if (loading) return <Loading />;
  if (!data) return <ErrorNote message={error} />;

  const refresh = async () => {
    await reload();
    await reloadHome();
  };
  const open = data.find((p) => p.id === openId) ?? null;
  const today = todayIso();
  const waiting = data.filter((p) => p.status === "AWAITING_APPROVAL").length;
  const monthPrefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`;
  const listPosts = view === "list" ? data : data.filter((p) => p.publishDate.startsWith(monthPrefix));

  const go = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <>
      <PageHead
        title="Content calendar"
        lead={waiting > 0 ? `${waiting} ${waiting === 1 ? "post is" : "posts are"} waiting for approval.` : "Everything planned, and where it stands."}
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
            {isAdmin ? <Btn onClick={() => setCreating(true)}>New post</Btn> : null}
          </>
        }
      />

      {view === "month" && wide ? (
        <>
          <div className="cal-nav">
            <Btn kind="quiet" onClick={() => go(-1)} aria-label="Previous month">
              Previous
            </Btn>
            <h2>
              {MONTH_NAMES[cursor.m]} {cursor.y}
            </h2>
            <Btn kind="quiet" onClick={() => go(1)} aria-label="Next month">
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
                      <button key={p.id} className={`cal-post st-${p.status.toLowerCase()}`} onClick={() => setOpenId(p.id)}>
                        <span className="cal-post-plat">{p.platform}</span>
                        <span className="cal-post-state">{STATUS_LABEL[p.status]}</span>
                      </button>
                    ))
                  : null}
              </div>
            ))}
          </div>
          {listPosts.length === 0 ? <Empty>No posts planned for this month.</Empty> : null}
        </>
      ) : listPosts.length === 0 ? (
        <Empty>No posts planned yet.</Empty>
      ) : (
        <ul className="post-list">
          {listPosts.map((p) => (
            <li key={p.id}>
              <button onClick={() => setOpenId(p.id)}>
                <span className="post-date">{fmtShort(p.publishDate)}</span>
                <span className="post-main">
                  <strong>{p.platform}</strong>
                  <span className="muted">{p.caption ? p.caption.slice(0, 90) : "No caption yet"}</span>
                </span>
                <StatusChip status={p.status} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <Drawer title={`${open.platform}, ${fmtShort(open.publishDate)}`} onClose={() => setOpenId(null)}>
          <PostDetail post={open} onDone={refresh} onClose={() => setOpenId(null)} />
        </Drawer>
      ) : null}
      {creating ? (
        <Drawer title="New post" onClose={() => setCreating(false)}>
          <NewPost onDone={refresh} onClose={() => setCreating(false)} />
        </Drawer>
      ) : null}
    </>
  );
}
