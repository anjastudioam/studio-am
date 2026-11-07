import { FormEvent, useState } from "react";
import { api } from "../api";
import { usePortal } from "../components/Shell";
import { Btn, ConfirmDelete, Empty, ErrorNote, Field, Loading, PageHead } from "../components/ui";
import { hostOf } from "../format";
import { useAction, useLoad } from "../hooks";
import { LINK_TYPES, LinkItem } from "../types";

export function LinksPage() {
  const { slug, isAdmin, reloadHome } = usePortal();
  const { data, error, loading, reload } = useLoad<LinkItem[]>(`/api/c/${slug}/links`);
  const [type, setType] = useState(LINK_TYPES[0].value);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const add = useAction();

  if (loading) return <Loading />;
  if (!data) return <ErrorNote message={error} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await add.run(() => api.post(`/api/c/${slug}/links`, { type, title, url }));
    if (res) {
      setTitle("");
      setUrl("");
      await reload();
      await reloadHome();
    }
  };

  const groups = LINK_TYPES.map((t) => ({ ...t, items: data.filter((l) => l.type === t.value) })).filter((g) => isAdmin || g.items.length > 0);

  return (
    <>
      <PageHead title="Links" lead="Everything you need, one tap away." />
      {isAdmin ? (
        <form className="inline-form" onSubmit={submit}>
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {LINK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Instagram" />
          </Field>
          <Field label="Link" hint="Must start with https://">
            <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </Field>
          <Btn type="submit" busy={add.busy}>
            Add link
          </Btn>
          <ErrorNote message={add.error} />
        </form>
      ) : null}

      {groups.length === 0 ? <Empty>No links have been added yet.</Empty> : null}
      {groups.map((g) => (
        <section className="block" key={g.value}>
          <h2>{g.label}</h2>
          {g.items.length === 0 ? (
            <p className="muted">Nothing added yet.</p>
          ) : (
            <ul className="row-list">
              {g.items.map((l) => (
                <li key={l.id}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    <span className="row-title">{l.title}</span>
                    <span className="row-sub">{hostOf(l.url)}</span>
                  </a>
                  {isAdmin ? (
                    <ConfirmDelete
                      onConfirm={async () => {
                        await api.del(`/api/c/${slug}/links/${l.id}`);
                        await reload();
                        await reloadHome();
                      }}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}
