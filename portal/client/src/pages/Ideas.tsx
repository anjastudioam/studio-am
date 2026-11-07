import { FormEvent, useState } from "react";
import { api } from "../api";
import { usePortal } from "../components/Shell";
import { Btn, ConfirmDelete, Empty, ErrorNote, Field, Loading, PageHead } from "../components/ui";
import { fmtDate, hostOf } from "../format";
import { useAction, useLoad } from "../hooks";
import type { Idea } from "../types";

export function IdeasPage() {
  const { slug, isAdmin } = usePortal();
  const { data, error, loading, reload } = useLoad<Idea[]>(`/api/c/${slug}/ideas`);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [pillar, setPillar] = useState("");
  const add = useAction();

  if (loading) return <Loading />;
  if (!data) return <ErrorNote message={error} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await add.run(() =>
      api.post(`/api/c/${slug}/ideas`, { title, ...(note ? { note } : {}), ...(url ? { url } : {}), ...(pillar ? { pillar } : {}) }),
    );
    if (res) {
      setTitle("");
      setNote("");
      setUrl("");
      setPillar("");
      await reload();
    }
  };

  return (
    <>
      <PageHead title="Idea bank" lead="Park content ideas here. We'll turn the best ones into posts." />
      <form className="inline-form" onSubmit={submit}>
        <Field label="Idea">
          <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. A day in the workshop" />
        </Field>
        <Field label="Details">
          <textarea rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Field label="Theme" hint="Optional, e.g. behind the scenes">
          <input maxLength={80} value={pillar} onChange={(e) => setPillar(e.target.value)} />
        </Field>
        <Field label="Reference link" hint="Optional, https:// only">
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
        <Btn type="submit" busy={add.busy}>
          Add idea
        </Btn>
        <ErrorNote message={add.error} />
      </form>
      {data.length === 0 ? (
        <Empty>No ideas yet. Add the first one above.</Empty>
      ) : (
        <ul className="idea-list">
          {data.map((i) => (
            <li key={i.id}>
              <div>
                <h3>{i.title}</h3>
                {i.note ? <p className="prewrap">{i.note}</p> : null}
                <p className="muted small">
                  {[i.pillar, i.url ? hostOf(i.url) : null, fmtDate(i.createdAt)].filter(Boolean).join(" · ")}
                  {i.url ? (
                    <>
                      {" "}
                      <a className="text-link" href={i.url} target="_blank" rel="noopener noreferrer">
                        Open
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
              {isAdmin ? (
                <ConfirmDelete
                  onConfirm={async () => {
                    await api.del(`/api/c/${slug}/ideas/${i.id}`);
                    await reload();
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
