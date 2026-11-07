import { FormEvent, useState } from "react";
import { api } from "../api";
import { usePortal } from "../components/Shell";
import { Btn, ConfirmDelete, Empty, ErrorNote, Field, Loading, PageHead } from "../components/ui";
import { useAction, useLoad } from "../hooks";
import type { MoodItem } from "../types";

function Tile({ item, onDelete }: { item: MoodItem; onDelete?: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="tile">
      {failed ? (
        <div className="tile-broken">This image couldn't load. Check the link.</div>
      ) : (
        <img src={item.imageUrl} alt={item.caption ?? "Moodboard image"} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      )}
      {item.caption || item.tags.length > 0 || onDelete ? (
        <figcaption>
          {item.caption ? <span>{item.caption}</span> : null}
          {item.tags.length > 0 ? <span className="muted small">{item.tags.join(", ")}</span> : null}
          {onDelete ? <ConfirmDelete onConfirm={onDelete} /> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function MoodboardPage() {
  const { slug, isAdmin } = usePortal();
  const { data, error, loading, reload } = useLoad<MoodItem[]>(`/api/c/${slug}/mood`);
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const add = useAction();

  if (loading) return <Loading />;
  if (!data) return <ErrorNote message={error} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const res = await add.run(() => api.post(`/api/c/${slug}/mood`, { imageUrl, ...(caption ? { caption } : {}), ...(tagList.length ? { tags: tagList } : {}) }));
    if (res) {
      setImageUrl("");
      setCaption("");
      setTags("");
      await reload();
    }
  };

  return (
    <>
      <PageHead title="Moodboard" lead="The look and feel we're aiming for." />
      <form className="inline-form" onSubmit={submit}>
        <Field label="Image link" hint="A direct https:// link to the image">
          <input required type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Caption">
          <input maxLength={300} value={caption} onChange={(e) => setCaption(e.target.value)} />
        </Field>
        <Field label="Tags" hint="Separate with commas">
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="warm, natural light" />
        </Field>
        <Btn type="submit" busy={add.busy}>
          Add to moodboard
        </Btn>
        <ErrorNote message={add.error} />
      </form>
      {data.length === 0 ? (
        <Empty>The moodboard is empty. Add an image link above.</Empty>
      ) : (
        <div className="mood-grid">
          {data.map((m) => (
            <Tile
              key={m.id}
              item={m}
              onDelete={
                isAdmin
                  ? async () => {
                      await api.del(`/api/c/${slug}/mood/${m.id}`);
                      await reload();
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
