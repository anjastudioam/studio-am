import { ButtonHTMLAttributes, ReactNode, useEffect, useRef, useState } from "react";
import { PostStatus, STATUS_LABEL, stageOf } from "../types";

export function Btn({
  kind = "primary",
  busy,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "quiet" | "danger"; busy?: boolean }) {
  return (
    <button {...rest} className={`btn btn-${kind} ${rest.className ?? ""}`} disabled={rest.disabled || busy} type={rest.type ?? "button"}>
      {busy ? "Working…" : children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function StatusChip({ status }: { status: PostStatus }) {
  return <span className={`chip chip-${stageOf(status).toLowerCase()}`}>{STATUS_LABEL[status]}</span>;
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="error-note" role="alert">
      {message}
    </p>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Loading() {
  return (
    <div className="loading" role="status" aria-live="polite">
      Loading…
    </div>
  );
}

/** Two-step delete so nothing disappears on a stray tap. */
export function ConfirmDelete({ onConfirm, label = "Delete" }: { onConfirm: () => void; label?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return armed ? (
    <Btn kind="danger" onClick={onConfirm}>
      Confirm delete
    </Btn>
  ) : (
    <Btn kind="quiet" onClick={() => setArmed(true)} aria-label={label}>
      {label}
    </Btn>
  );
}

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="drawer-wrap">
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <button className="btn btn-quiet" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  );
}

export function PageHead({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {lead ? <p className="lead">{lead}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
