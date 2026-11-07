import { FormEvent, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Btn, ErrorNote, Field, Loading } from "../components/ui";
import { useAction } from "../hooks";

export function LoginPage() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useAction();

  if (loading) return <Loading />;
  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(async () => {
      await api.post("/api/auth/request", { email });
      return true;
    });
    if (ok) setSent(true);
  };

  return (
    <div className="login">
      <div className="mist" aria-hidden="true" />
      <div className="login-form">
        {sent ? (
          <div className="login-card" role="status">
            <img className="login-logo" src="/logo.png" alt="Studio AM" width={72} height={72} />
            <h1>Check your email</h1>
            <p className="lead">
              If <strong>{email}</strong> is registered, a sign-in link is on its way. It works once and expires in 15 minutes.
            </p>
            <Btn kind="quiet" onClick={() => setSent(false)}>
              Use a different email
            </Btn>
          </div>
        ) : (
          <form className="login-card" onSubmit={submit}>
            <img className="login-logo" src="/logo.png" alt="Studio AM" width={72} height={72} />
            <h1>Sign in to Studio AM</h1>
            <p className="lead">Enter your email and we'll send you a sign-in link. No password needed.</p>
            <Field label="Email address">
              <input type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio-am.co.za" />
            </Field>
            <ErrorNote message={error} />
            <Btn type="submit" busy={busy}>
              Email me a sign-in link
            </Btn>
          </form>
        )}
      </div>
    </div>
  );
}

export function VerifyPage() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // The link is single-use, so guard against React running this twice.
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
    history.replaceState(null, "", window.location.pathname);
    if (!token) {
      setError("This sign-in link is incomplete. Request a new one.");
      return;
    }
    api
      .post("/api/auth/verify", { token })
      .then(async () => {
        await refresh();
        nav("/", { replace: true });
      })
      .catch((e: Error) => setError(e.message));
  }, [nav, refresh]);

  if (!error) return <Loading />;
  return (
    <div className="center-note glass">
      <h1>That link didn't work</h1>
      <p>{error}</p>
      <Btn onClick={() => nav("/login")}>Request a new link</Btn>
    </div>
  );
}
