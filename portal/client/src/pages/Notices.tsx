import { FormEvent, useState } from "react";
import { api } from "../api";
import { usePortal } from "../components/Shell";
import { Btn, ConfirmDelete, Empty, ErrorNote, Field, Loading, PageHead } from "../components/ui";
import { fmtDate } from "../format";
import { useAction, useLoad } from "../hooks";
import type { Notice } from "../types";

export function NoticesPage() {
  const { slug, isAdmin, reloadHome } = usePortal();
  const { data, error, loading, reload } = useLoad<Notice[]>(`/api/c/${slug}/notices`);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const add = useAction();
  const toggle = useAction();

  if (loading) return <Loading />;
  if (!data) return <ErrorNote message={error} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await add.run(() => api.post(`/api/c/${slug}/notices`, { title, body, pinned }));
    if (res) {
      setTitle("");
      setBody("");
      setPinned(false);
      await reload();
      await reloadHome();
    }
  };

  return (
    <>
      <PageHead title="Notice board" lead="News and updates from Studio AM." />
      {isAdmin ? (
        <form className="inline-form" onSubmit={submit}>
          <Field label="Title">
            <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Message">
            <textarea rows={3} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            <span>Pin to the top</span>
          </label>
          <Btn type="submit" busy={add.busy}>
            Post notice
          </Btn>
          <ErrorNote message={add.error} />
        </form>
      ) : null}
      {data.length === 0 ? (
        <Empty>No notices yet.</Empty>
      ) : (
        <ul className="notice-list wide">
          {data.map((n) => (
            <li key={n.id} className={n.pinned ? "pinned" : ""}>
              <h3>
                {n.title}
                {n.pinned ? <span className="pin">Pinned</span> : null}
              </h3>
              <p className="muted small">{fmtDate(n.createdAt)}</p>
              {n.body ? <p className="prewrap">{n.body}</p> : null}
              {isAdmin ? (
                <div className="row-actions">
                  <Btn
                    kind="quiet"
                    busy={toggle.busy}
                    onClick={async () => {
                      await toggle.run(() => api.patch(`/api/c/${slug}/notices/${n.id}`, { pinned: !n.pinned }));
                      await reload();
                      await reloadHome();
                    }}
                  >
                    {n.pinned ? "Unpin" : "Pin"}
                  </Btn>
                  <ConfirmDelete
                    onConfirm={async () => {
                      await api.del(`/api/c/${slug}/notices/${n.id}`);
                      await reload();
                      await reloadHome();
                    }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
