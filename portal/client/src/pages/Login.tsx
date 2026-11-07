import { FormEvent, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Btn, ErrorNote, Field, Loading } from "../components/ui";
import { useAction } from "../hooks";

export function LoginPage() {
  const { user, loading, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const { busy, error, run } = useAction();

  if (loading) return <Loading />;
  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(async () => {
      await api.post("/api/auth/login", { email, password });
      return true;
    });
    if (ok) await refresh();
  };

  return (
    <div className="login">
      <div className="mist" aria-hidden="true" />
      <div className="login-form">
        <form className="login-card" onSubmit={submit}>
          <img className="login-logo" src="/logo.png" alt="Studio AM" width={72} height={72} />
          <h1>Sign in to Studio AM</h1>
          <p className="lead">Use your email and password. You'll stay signed in on this device.</p>
          <Field label="Email address">
            <input type="email" required autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio-am.co.za" />
          </Field>
          <Field label="Password">
            <input type={show ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <label className="check small">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            <span>Show password</span>
          </label>
          <ErrorNote message={error} />
          <Btn type="submit" busy={busy}>
            Sign in
          </Btn>
        </form>
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
