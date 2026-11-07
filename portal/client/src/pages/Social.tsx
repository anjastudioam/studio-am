import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { PostDetail, NewPost } from "../components/PostForms";
import { RecordsView } from "../components/Records";
import { Btn, Drawer, Empty, Field, Loading, PageHead, StatusChip } from "../components/ui";
import { fmtShort } from "../format";
import { useAction, useLoad } from "../hooks";
import type { AdminClient, MasterPost } from "../types";
import { STAGES, STATUS_LABEL, stageOf } from "../types";

const TABS = [
  { key: "pipeline", label: "Content pipeline" },
  { key: "accounts", label: "Accounts" },
  { key: "captions", label: "Caption bank" },
  { key: "hashtags", label: "Hashtag bank" },
];

function Pipeline({ clientSlug }: { clientSlug?: string }) {
  const posts = useLoad<MasterPost[]>("/api/admin/posts");
  const clients = useLoad<AdminClient[]>("/api/admin/clients");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pick, setPick] = useState(clientSlug ?? "");
  const move = useAction();
  if (posts.loading || clients.loading) return <Loading />;
  const rows = (posts.data ?? []).filter((p) => !clientSlug || p.clientSlug === clientSlug);
  const open = rows.find((p) => p.id === openId) ?? null;
  const active = (clients.data ?? []).filter((c) => c.status !== "ARCHIVED");

  return (
    <>
      <div className="row-actions embedded-head">
        <Link className="btn btn-quiet" to={clientSlug ? `/c/${clientSlug}/calendar` : "/admin/calendar"}>Open calendar</Link>
        <Btn onClick={() => setCreating(true)}>New content</Btn>
      </div>
      {rows.length === 0 ? (
        <Empty action={<Btn onClick={() => setCreating(true)}>New content</Btn>}>No content yet. Start with an idea and move it through the stages.</Empty>
      ) : (
        <div className="board stages">
          {STAGES.map((s) => {
            const col = rows.filter((p) => stageOf(p.status) === s);
            return (
              <section key={s} className="board-col">
                <header>
                  <StatusChip status={s} />
                  <span className="muted">{col.length}</span>
                </header>
                {col.map((p) => (
                  <article key={p.id} className="board-card">
                    <button className="board-title" onClick={() => setOpenId(p.id)}>
                      {p.title || (p.caption ? p.caption.slice(0, 60) : `${p.platform} post`)}
                    </button>
                    <p className="muted small">{[!clientSlug ? p.clientName : null, p.platform, p.format, fmtShort(p.publishDate)].filter(Boolean).join(" · ")}</p>
                    <select
                      aria-label="Move to stage"
                      value={stageOf(p.status)}
                      onChange={async (e) => {
                        await move.run(() => api.patch(`/api/c/${p.clientSlug}/posts/${p.id}`, { status: e.target.value }));
                        await posts.reload();
                      }}
                    >
                      {STAGES.map((x) => (
                        <option key={x} value={x}>{STATUS_LABEL[x]}</option>
                      ))}
                    </select>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
      {open ? (
        <Drawer title={open.title || `${open.platform} post`} onClose={() => setOpenId(null)}>
          <PostDetail post={open} slug={open.clientSlug} onDone={async () => void (await posts.reload())} onClose={() => setOpenId(null)} />
        </Drawer>
      ) : null}
      {creating ? (
        <Drawer title="New content" onClose={() => setCreating(false)}>
          {!pick ? (
            <Field label="Which client is this for?">
              <select value={pick} onChange={(e) => setPick(e.target.value)} autoFocus>
                <option value="">Choose a client</option>
                {active.map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </Field>
          ) : (
            <NewPost slug={pick} onDone={async () => void (await posts.reload())} onClose={() => setCreating(false)} />
          )}
        </Drawer>
      ) : null}
    </>
  );
}

export function SocialHub({ clientSlug }: { clientSlug?: string }) {
  const [tab, setTab] = useState("pipeline");
  return (
    <>
      {clientSlug ? null : <PageHead title="Social Media" lead="Plan content, move it through the stages, and keep accounts, captions and hashtags in one place." />}
      <div className="tabs-row" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {tab === "pipeline" ? <Pipeline clientSlug={clientSlug} /> : <RecordsView key={tab} module={tab} clientSlug={clientSlug} embedded />}
    </>
  );
}
