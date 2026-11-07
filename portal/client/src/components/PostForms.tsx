import { FormEvent, useState } from "react";
import { api } from "../api";
import { Btn, ConfirmDelete, Field, ErrorNote, StatusChip } from "./ui";
import { fmtDate, hostOf, todayIso } from "../format";
import { useAction } from "../hooks";
import { Post, PostStatus, STAGES, STATUS_LABEL, stageOf } from "../types";

export const STATUSES = [...STAGES] as PostStatus[];
const PLATFORMS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube", "Pinterest", "X", "Other"];
const FORMATS = ["", "Reel", "Carousel", "Single image", "Story", "Video", "Text post", "Article"];

type Draft = { title: string; campaign: string; publishDate: string; platform: string; format: string; pillar: string; caption: string; assetUrl: string; status: PostStatus; internalNote: string };

const toBody = (f: Draft, editing: boolean) => {
  const opt = (v: string) => (editing ? v || null : v || undefined);
  return {
    publishDate: f.publishDate,
    platform: f.platform,
    status: f.status,
    title: opt(f.title),
    campaign: opt(f.campaign),
    format: opt(f.format),
    pillar: opt(f.pillar),
    assetUrl: opt(f.assetUrl),
    internalNote: opt(f.internalNote),
    ...(editing || f.caption ? { caption: f.caption } : {}),
  };
};

function PostFields({ f, setF }: { f: Draft; setF: (d: Draft) => void }) {
  return (
    <>
      <Field label="Content title">
        <input value={f.title} maxLength={200} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="What is this post about?" />
      </Field>
      <Field label="Stage">
        <select value={stageOf(f.status)} onChange={(e) => setF({ ...f, status: e.target.value as PostStatus })}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Publish date">
        <input type="date" required value={f.publishDate} onChange={(e) => setF({ ...f, publishDate: e.target.value })} />
      </Field>
      <Field label="Platform">
        <select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}>
          {(PLATFORMS.includes(f.platform) ? PLATFORMS : [f.platform, ...PLATFORMS]).map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </Field>
      <Field label="Content type">
        <select value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}>
          {(FORMATS.includes(f.format) ? FORMATS : [f.format, ...FORMATS]).map((p) => (
            <option key={p} value={p}>
              {p || "Not set"}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Campaign">
        <input value={f.campaign} maxLength={120} onChange={(e) => setF({ ...f, campaign: e.target.value })} />
      </Field>
      <Field label="Content pillar">
        <input value={f.pillar} maxLength={80} onChange={(e) => setF({ ...f, pillar: e.target.value })} />
      </Field>
      <Field label="Caption">
        <textarea rows={5} value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} />
      </Field>
      <Field label="Media link" hint="A Google Drive or similar https:// link">
        <input type="url" value={f.assetUrl} onChange={(e) => setF({ ...f, assetUrl: e.target.value })} />
      </Field>
      <Field label="Internal notes">
        <textarea rows={2} value={f.internalNote} onChange={(e) => setF({ ...f, internalNote: e.target.value })} />
      </Field>
    </>
  );
}

export function PostDetail({ post, slug, onDone, onClose }: { post: Post; slug: string; isAdmin?: boolean; onDone: () => Promise<void>; onClose: () => void }) {
  const save = useAction();
  const [f, setF] = useState<Draft>({
    title: post.title ?? "",
    campaign: post.campaign ?? "",
    publishDate: post.publishDate,
    platform: post.platform,
    format: post.format ?? "",
    pillar: post.pillar ?? "",
    caption: post.caption,
    assetUrl: post.assetUrl ?? "",
    status: stageOf(post.status),
    internalNote: post.internalNote ?? "",
  });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await save.run(() => api.patch(`/api/c/${slug}/posts/${post.id}`, toBody(f, true)));
    if (res) {
      await onDone();
      onClose();
    }
  };
  return (
    <>
      <div className="post-meta">
        <StatusChip status={post.status} />
        <span>{fmtDate(post.publishDate)}</span>
        {post.assetUrl ? (
          <a className="text-link" href={post.assetUrl} target="_blank" rel="noopener noreferrer">
            Media ({hostOf(post.assetUrl)})
          </a>
        ) : null}
      </div>
      <form className="drawer-form" onSubmit={submit}>
        <PostFields f={f} setF={setF} />
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
    </>
  );
}

export function NewPost({ slug, onDone, onClose, initialDate }: { slug: string; onDone: () => Promise<void>; onClose: () => void; initialDate?: string }) {
  const add = useAction();
  const [f, setF] = useState<Draft>({ title: "", campaign: "", publishDate: initialDate ?? todayIso(), platform: "Instagram", format: "", pillar: "", caption: "", assetUrl: "", status: "IDEA", internalNote: "" });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = Object.fromEntries(Object.entries(toBody(f, false)).filter(([, v]) => v !== undefined));
    const res = await add.run(() => api.post(`/api/c/${slug}/posts`, body));
    if (res) {
      await onDone();
      onClose();
    }
  };
  return (
    <form className="drawer-form" onSubmit={submit}>
      <PostFields f={f} setF={setF} />
      <Btn type="submit" busy={add.busy}>
        Add post
      </Btn>
      <ErrorNote message={add.error} />
    </form>
  );
}
