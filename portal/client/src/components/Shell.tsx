import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import type { AdminClient } from "../types";
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

function ClientSwitcher({ current }: { current: string }) {
  const nav = useNavigate();
  const { data } = useLoad<AdminClient[]>("/api/admin/clients");
  if (!data) return null;
  const active = data.filter((c) => c.status !== "ARCHIVED");
  return (
    <label className="switcher">
      <span className="sr-only">Switch client</span>
      <select value={current} onChange={(e) => nav(`/c/${e.target.value}`)} aria-label="Switch client">
        {active.map((c) => (
          <option key={c.id} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
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
    ...(isAdmin
      ? [
          { to: "/admin/calendar", label: "Master calendar", mobileOnly: true },
          { to: "/admin", label: "All clients", mobileOnly: true },
        ]
      : []),
  ];

  return (
    <PortalContext.Provider value={{ slug, home: data, reloadHome: reload, isAdmin, base }}>
      <div className="shell">
        <aside className="rail">
          <Brand />
          <div className="rail-client">
            <span className="rail-kicker">{isAdmin ? "Working on" : "Your portal"}</span>
            <strong>{data.client.name}</strong>
            {isAdmin ? <ClientSwitcher current={slug} /> : null}
          </div>
          <nav className="rail-nav" aria-label="Sections">
            {items.map((i) => (
              <NavLink
                key={i.label}
                to={i.to}
                end={"end" in i ? i.end : false}
                className={({ isActive }) => `${isActive ? "active" : ""} ${"mobileOnly" in i ? "mobile-only" : ""}`}
              >
                {i.label}
              </NavLink>
            ))}
          </nav>
          {isAdmin ? (
            <div className="rail-group">
              <NavLink className="rail-link rail-back" to="/admin/calendar">
                Master calendar
              </NavLink>
              <NavLink className="rail-link rail-back" to="/admin">
                All clients
              </NavLink>
            </div>
          ) : null}
          <SignOut />
        </aside>
        <main className="main" id="main">
          <Outlet />
        </main>
      </div>
    </PortalContext.Provider>
  );
}

export function AdminShell() {
  const items = [
    { to: "/admin", label: "Clients", end: true },
    { to: "/admin/calendar", label: "Master calendar" },
  ];
  return (
    <div className="shell">
      <aside className="rail">
        <Brand />
        <div className="rail-client">
          <span className="rail-kicker">Studio AM</span>
          <strong>All clients</strong>
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
