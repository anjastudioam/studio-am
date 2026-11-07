import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { createContext, useContext } from "react";
import { useAuth } from "../auth";
import { useLoad } from "../hooks";
import type { Home } from "../types";
import { ErrorNote, Loading } from "./ui";

type PortalCtx = { slug: string; home: Home; reloadHome: () => Promise<void>; isAdmin: boolean; base: string };
const PortalContext = createContext<PortalCtx | null>(null);
export const usePortal = () => {
  const v = useContext(PortalContext);
  if (!v) throw new Error("usePortal outside portal");
  return v;
};

function Brand() {
  return (
    <div className="brand">
      <img src="/logo.png" alt="Studio AM" width={132} height={132} />
    </div>
  );
}

function SignOut() {
  const { logout, user } = useAuth();
  const nav = useNavigate();
  return (
    <div className="rail-foot">
      <span className="rail-user">{user?.name}</span>
      <button
        className="rail-link"
        onClick={async () => {
          await logout();
          nav("/login");
        }}
      >
        Sign out
      </button>
    </div>
  );
}

export function PortalShell() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { data, error, loading, reload } = useLoad<Home>(`/api/c/${encodeURIComponent(slug)}/home`);
  const base = `/c/${slug}`;

  if (loading) return <Loading />;
  if (error || !data)
    return (
      <div className="center-note">
        <h1>We can't find that page</h1>
        <p>{error ?? "It may have moved, or you may not have access."}</p>
        <NavLink to="/">Back to start</NavLink>
      </div>
    );

  const items = [
    { to: base, label: "Home", end: true },
    { to: `${base}/calendar`, label: "Content calendar" },
    { to: `${base}/files`, label: "Files" },
    { to: `${base}/links`, label: "Links" },
    { to: `${base}/tasks`, label: "To-do" },
    { to: `${base}/ideas`, label: "Idea bank" },
    { to: `${base}/moodboard`, label: "Moodboard" },
    { to: `${base}/notices`, label: "Notice board" },
  ];

  return (
    <PortalContext.Provider value={{ slug, home: data, reloadHome: reload, isAdmin, base }}>
      <div className="shell">
        <aside className="rail">
          <Brand />
          <div className="rail-client">
            <span className="rail-kicker">{isAdmin ? "Client portal" : "Your portal"}</span>
            <strong>{data.client.name}</strong>
          </div>
          <nav className="rail-nav" aria-label="Sections">
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? "active" : "")}>
                {i.label}
              </NavLink>
            ))}
          </nav>
          {isAdmin ? (
            <NavLink className="rail-link rail-back" to="/admin">
              All clients
            </NavLink>
          ) : null}
          <SignOut />
        </aside>
        <main className="main" id="main">
          {isAdmin ? (
            <p className="admin-banner">
              You're viewing {data.client.name} as Studio AM. Clients see the same pages without the edit controls.
            </p>
          ) : null}
          <Outlet />
        </main>
      </div>
    </PortalContext.Provider>
  );
}

export function AdminShell() {
  const items = [{ to: "/admin", label: "Clients", end: true }];
  return (
    <div className="shell">
      <aside className="rail">
        <Brand />
        <div className="rail-client">
          <span className="rail-kicker">Studio AM</span>
          <strong>Agency view</strong>
        </div>
        <nav className="rail-nav" aria-label="Admin">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? "active" : "")}>
              {i.label}
            </NavLink>
          ))}
        </nav>
        <SignOut />
      </aside>
      <main className="main" id="main">
        <Outlet />
      </main>
    </div>
  );
}

export { ErrorNote };
