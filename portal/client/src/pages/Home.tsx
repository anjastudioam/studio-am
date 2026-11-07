import { Link } from "react-router-dom";
import { usePortal } from "../components/Shell";
import { Empty, PageHead } from "../components/ui";
import { fmtDate, hostOf, plural } from "../format";
import { FOLDERS, linkLabel } from "../types";
import { useState } from "react";
import { useAuth } from "../auth";
import { TaskRow } from "./Tasks";
import type { Task } from "../types";

export function HomePage() {
  const { home, base, isAdmin, reloadHome } = usePortal();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const openTasks = tasks ?? home.openTasks;

  const waiting = home.awaitingApproval;
  const lead = isAdmin
    ? waiting > 0
      ? `${waiting} ${plural(waiting, "post is", "posts are")} waiting for this client's approval.`
      : "No posts are waiting for approval."
    : waiting > 0
      ? `${waiting} ${plural(waiting, "post is", "posts are")} waiting for your approval.`
      : "You're all caught up. Nothing is waiting for you.";

  return (
    <>
      <PageHead
        title={isAdmin ? home.client.name : `Hello, ${user?.name.split(" ")[0]}`}
        lead={
          <>
            {lead}{" "}
            {waiting > 0 ? (
              <Link className="text-link" to={`${base}/calendar`}>
                Review in the calendar
              </Link>
            ) : home.nextPost ? (
              <>
                Next up: {home.nextPost.platform} on {fmtDate(home.nextPost.publishDate)}.
              </>
            ) : null}
          </>
        }
      />

      <div className="home-grid">
        <section className="block span-notice">
          <div className="block-head">
            <h2>Notice board</h2>
            <Link className="text-link" to={`${base}/notices`}>
              All notices
            </Link>
          </div>
          {home.notices.length === 0 ? (
            <Empty>No notices yet. Updates from Studio AM will appear here.</Empty>
          ) : (
            <ul className="notice-list">
              {home.notices.map((n) => (
                <li key={n.id} className={n.pinned ? "pinned" : ""}>
                  <h3>
                    {n.title}
                    {n.pinned ? <span className="pin">Pinned</span> : null}
                  </h3>
                  {n.body ? <p>{n.body}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="block span-todo">
          <div className="block-head">
            <h2>To-do</h2>
            <Link className="text-link" to={`${base}/tasks`}>
              All to-dos
            </Link>
          </div>
          {openTasks.length === 0 ? (
            <Empty>Nothing to do right now.</Empty>
          ) : (
            <ul className="task-list">
              {openTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onChange={() => {
                    setTasks(openTasks.filter((x) => x.id !== t.id));
                    void reloadHome();
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="block span-links">
          <div className="block-head">
            <h2>Link stack</h2>
            <Link className="text-link" to={`${base}/links`}>
              All links
            </Link>
          </div>
          {home.linkStack.length === 0 ? (
            <Empty>No links yet.</Empty>
          ) : (
            <ul className="link-list">
              {home.linkStack.map((l) => (
                <li key={l.id}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    <span className="link-type">{linkLabel(l.type)}</span>
                    <span className="link-title">{l.title}</span>
                    <span className="link-host">{hostOf(l.url)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="block span-folders">
          <div className="block-head">
            <h2>Files</h2>
            <Link className="text-link" to={`${base}/files`}>
              Open files
            </Link>
          </div>
          <ul className="folder-list">
            {FOLDERS.map((f) => (
              <li key={f.value}>
                <Link to={`${base}/files?folder=${f.value}`}>
                  <span>{f.label}</span>
                  <span className="count">
                    {home.folders[f.value] ?? 0} {plural(home.folders[f.value] ?? 0, "item", "items")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
