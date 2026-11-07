import { FormEvent, useState } from "react";
import { api } from "../api";
import { Btn, ConfirmDelete, Field, ErrorNote, StatusChip } from "./ui";
import { fmtDate, fmtDateTime, hostOf, todayIso } from "../format";
import { useAction, useLoad } from "../hooks";
import { Post, PostEvent, PostStatus, STATUS_LABEL } from "../types";

export const STATUSES = Object.keys(STATUS_LABEL) as PostStatus[];

export function PostDetail({ post, slug, isAdmin, onDone, onClose }: { post: Post; slug: string; isAdmin: boolean; onDone: () => Promise<void>; onClose: () => void }) {
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

export function NewPost({ slug, onDone, onClose }: { slug: string; onDone: () => Promise<void>; onClose: () => void }) {
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

