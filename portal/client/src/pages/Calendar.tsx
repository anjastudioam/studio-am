import { useEffect, useMemo, useState } from "react";
import { usePortal } from "../components/Shell";
import { Btn, Drawer, Empty, ErrorNote, Loading, PageHead, StatusChip } from "../components/ui";
import { NewPost, PostDetail } from "../components/PostForms";
import { fmtShort, todayIso } from "../format";
import { useLoad, useMedia } from "../hooks";
import { Post, STATUS_LABEL, stageOf } from "../types";

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
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
  const waiting = data.filter((p) => stageOf(p.status) === "INTERNAL_REVIEW").length;
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
        lead={waiting > 0 ? `${waiting} ${waiting === 1 ? "post is" : "posts are"} in internal review.` : "Everything planned, and where it stands."}
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
                      <button key={p.id} className={`cal-post st-${stageOf(p.status).toLowerCase()}`} onClick={() => setOpenId(p.id)}>
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
          <PostDetail post={open} slug={slug} isAdmin={isAdmin} onDone={refresh} onClose={() => setOpenId(null)} />
        </Drawer>
      ) : null}
      {creating ? (
        <Drawer title="New post" onClose={() => setCreating(false)}>
          <NewPost slug={slug} onDone={refresh} onClose={() => setCreating(false)} />
        </Drawer>
      ) : null}
    </>
  );
}
