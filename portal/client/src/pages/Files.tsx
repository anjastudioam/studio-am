import { FormEvent, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { usePortal } from "../components/Shell";
import { Btn, ConfirmDelete, Empty, ErrorNote, Field, Loading, PageHead } from "../components/ui";
import { fmtDate, hostOf } from "../format";
import { useAction, useLoad } from "../hooks";
import { FOLDERS, FileItem } from "../types";

export function FilesPage() {
  const { slug, isAdmin, reloadHome } = usePortal();
  const [params, setParams] = useSearchParams();
  const folder = FOLDERS.some((f) => f.value === params.get("folder")) ? params.get("folder")! : FOLDERS[0].value;
  const { data, error, loading, reload } = useLoad<FileItem[]>(`/api/c/${slug}/files`);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const add = useAction();

  if (loading) return <Loading />;
  if (!data) return <ErrorNote message={error} />;

  const items = data.filter((f) => f.folder === folder);
  const count = (v: string) => data.filter((f) => f.folder === v).length;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await add.run(() =>
      api.post(`/api/c/${slug}/files`, { folder, title, url, ...(note ? { note } : {}), ...(date ? { itemDate: date } : {}) }),
    );
    if (res) {
      setTitle("");
      setUrl("");
      setNote("");
      setDate("");
      await reload();
      await reloadHome();
    }
  };

  return (
    <>
      <PageHead title="Files" lead="Agreements, invoices and plans, kept together." />
      <nav className="tabs" aria-label="Folders">
        {FOLDERS.map((f) => (
          <button key={f.value} className={f.value === folder ? "active" : ""} aria-current={f.value === folder} onClick={() => setParams({ folder: f.value })}>
            {f.label}
            <span className="tab-count">{count(f.value)}</span>
          </button>
        ))}
      </nav>

      {items.length === 0 ? (
        <Empty>{isAdmin ? "Nothing in this folder yet. Add the first file below." : "Nothing in this folder yet."}</Empty>
      ) : (
        <ul className="row-list">
          {items.map((f) => (
            <li key={f.id}>
              <a href={f.url} target="_blank" rel="noopener noreferrer">
                <span className="row-title">{f.title}</span>
                <span className="row-sub">
                  {[f.itemDate ? fmtDate(f.itemDate) : null, hostOf(f.url), f.note].filter(Boolean).join(" · ")}
                </span>
              </a>
              {isAdmin ? (
                <ConfirmDelete
                  onConfirm={async () => {
                    await api.del(`/api/c/${slug}/files/${f.id}`);
                    await reload();
                    await reloadHome();
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {isAdmin ? (
        <form className="inline-form" onSubmit={submit}>
          <Field label="Name">
            <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Retainer agreement 2026" />
          </Field>
          <Field label="Google Drive link" hint="Must start with https://">
            <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/…" />
          </Field>
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Note">
            <input maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Btn type="submit" busy={add.busy}>
            Add to {FOLDERS.find((f) => f.value === folder)?.label}
          </Btn>
          <ErrorNote message={add.error} />
        </form>
      ) : null}
    </>
  );
}
