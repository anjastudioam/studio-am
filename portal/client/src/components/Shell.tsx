import { createContext, ReactNode, useContext } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  CalendarRange,
  FolderOpen,
  House,
  Images,
  Lightbulb,
  Link2,
  ListChecks,
  LogOut,
  Megaphone,
  Plus,
  Users,
} from "lucide-react";
import { useAuth } from "../auth";
import { useLoad } from "../hooks";
import type { AdminClient, Home } from "../types";
import { Loading } from "./ui";

type PortalCtx = { slug: string; home: Home; reloadHome: () => Promise<void>; isAdmin: boolean; base: string };
const PortalContext = createContext<PortalCtx | null>(null);
export const usePortal = () => {
  const v = useContext(PortalContext);
  if (!v) throw new Error("usePortal outside portal");
  return v;
};

type DockItem = { to: string; label: string; icon: ReactNode; end?: boolean };
const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;

function Mist() {
  return <div className="mist" aria-hidden="true" />;
}

function Dock({ global, local }: { global: DockItem[]; local?: DockItem[] }) {
  const { logout } = useAuth();
  const nav = useNavigate();
  const link = (i: DockItem) => (
    <NavLink key={i.to + i.label} to={i.to} end={i.end} className={({ isActive }) => `dock-item ${isActive ? "active" : ""}`} aria-label={i.label} data-label={i.label}>
      {i.icon}
    </NavLink>
  );
  return (
    <nav className="dock" aria-label="Main">
      <NavLink to="/admin" className="dock-brand" aria-label="Studio AM home" data-label="Studio AM">
        <img src="/logo.png" alt="" width={44} height={44} />
      </NavLink>
      <div className="dock-group">{global.map(link)}</div>
      {local && local.length > 0 ? (
        <>
          <span className="dock-sep" aria-hidden="true" />
          <div className="dock-group">{local.map(link)}</div>
        </>
      ) : null}
      <div className="dock-foot">
        <NavLink to="/admin/calendar?new=1" className="dock-item" aria-label="New post" data-label="New post">
          <Plus {...ICON} />
        </NavLink>
        <button
          className="dock-item"
          aria-label="Sign out"
          data-label="Sign out"
          onClick={async () => {
            await logout();
            nav("/login");
          }}
        >
          <LogOut {...ICON} />
        </button>
      </div>
    </nav>
  );
}

const GLOBAL_ITEMS: DockItem[] = [
  { to: "/admin", label: "Dashboard", icon: <House {...ICON} />, end: true },
  { to: "/admin/calendar", label: "Master calendar", icon: <CalendarDays {...ICON} /> },
  { to: "/admin/clients", label: "Clients", icon: <Users {...ICON} /> },
];

function ClientSwitcher({ current }: { current: string }) {
  const nav = useNavigate();
  const { data } = useLoad<AdminClient[]>("/api/admin/clients");
  if (!data) return null;
  const active = data.filter((c) => c.status !== "ARCHIVED");
  return (
    <label className="switcher">
      <span className="switcher-label">Client</span>
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
      <div className="frame">
        <Mist />
        <div className="center-note glass">
          <h1>We can't find that page</h1>
          <p>{error ?? "It may have moved, or you may not have access."}</p>
          <NavLink to="/" className="text-link">
            Back to start
          </NavLink>
        </div>
      </div>
    );

  const local: DockItem[] = [
    { to: base, label: "Client overview", icon: <House {...ICON} />, end: true },
    { to: `${base}/calendar`, label: "Client calendar", icon: <CalendarRange {...ICON} /> },
    { to: `${base}/files`, label: "Files", icon: <FolderOpen {...ICON} /> },
    { to: `${base}/links`, label: "Links", icon: <Link2 {...ICON} /> },
    { to: `${base}/tasks`, label: "To-do", icon: <ListChecks {...ICON} /> },
    { to: `${base}/ideas`, label: "Idea bank", icon: <Lightbulb {...ICON} /> },
    { to: `${base}/moodboard`, label: "Moodboard", icon: <Images {...ICON} /> },
    { to: `${base}/notices`, label: "Notice board", icon: <Megaphone {...ICON} /> },
  ];

  return (
    <PortalContext.Provider value={{ slug, home: data, reloadHome: reload, isAdmin, base }}>
      <div className="frame">
        <Mist />
        <Dock global={isAdmin ? GLOBAL_ITEMS : []} local={local} />
        <main className="canvas" id="main">
          <header className="topbar">
            <div className="chip-glass">
              <span className="muted">Working on</span> <strong>{data.client.name}</strong>
            </div>
            {isAdmin ? <ClientSwitcher current={slug} /> : null}
          </header>
          <div className="panel">
            <Outlet />
          </div>
        </main>
      </div>
    </PortalContext.Provider>
  );
}

export function AdminShell() {
  const { pathname } = useLocation();
  const dashboard = pathname === "/admin" || pathname === "/admin/";
  return (
    <div className="frame">
      <Mist />
      <Dock global={GLOBAL_ITEMS} />
      <main className="canvas" id="main">
        <div className={dashboard ? "stage" : "panel"}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
