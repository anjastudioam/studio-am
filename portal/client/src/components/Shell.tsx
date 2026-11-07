import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  ChevronDown,
  Plus,
  ClipboardCheck,
  FolderKanban,
  FolderOpen,
  Globe,
  LayoutDashboard,
  Library,
  Lightbulb,
  Link2,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Settings,
  Share2,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "../auth";
import { useLoad } from "../hooks";
import type { AdminClient, Home } from "../types";
import { GlobalSearch } from "./GlobalSearch";
import { Loading } from "./ui";

type PortalCtx = { slug: string; home: Home; reloadHome: () => Promise<void>; isAdmin: boolean; base: string };
const PortalContext = createContext<PortalCtx | null>(null);
export const usePortal = () => {
  const v = useContext(PortalContext);
  if (!v) throw new Error("usePortal outside portal");
  return v;
};

const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;

type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean; soon?: boolean; also?: string };
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Workspace",
    items: [
      { to: "/admin", label: "Dashboard", icon: <LayoutDashboard {...ICON} />, end: true },
      { to: "/admin/clients", label: "Client Directory", icon: <Users {...ICON} />, also: "/c/" },
      { to: "/admin/projects", label: "Projects", icon: <FolderKanban {...ICON} />, soon: true },
      { to: "/admin/tasks", label: "Task Manager", icon: <ListChecks {...ICON} /> },
      { to: "/admin/calendar", label: "Calendar", icon: <CalendarDays {...ICON} /> },
      { to: "/admin/ideas", label: "Idea Bank", icon: <Lightbulb {...ICON} />, soon: true },
    ],
  },
  {
    group: "Client operations",
    items: [
      { to: "/admin/brand", label: "Brand Management", icon: <Palette {...ICON} />, soon: true },
      { to: "/admin/social", label: "Social Media", icon: <Share2 {...ICON} />, soon: true },
      { to: "/admin/websites", label: "Website Management", icon: <Globe {...ICON} />, soon: true },
      { to: "/admin/audits", label: "Audits & Reporting", icon: <ClipboardCheck {...ICON} />, soon: true },
      { to: "/admin/meetings", label: "Meetings & Notes", icon: <NotebookPen {...ICON} />, soon: true },
    ],
  },
  {
    group: "Business management",
    items: [
      { to: "/admin/files", label: "File Repository", icon: <FolderOpen {...ICON} />, soon: true },
      { to: "/admin/finance", label: "Finance & Invoices", icon: <Wallet {...ICON} />, soon: true },
      { to: "/admin/leads", label: "Leads & Prospects", icon: <Target {...ICON} />, soon: true },
      { to: "/admin/resources", label: "Resource Library", icon: <Library {...ICON} />, soon: true },
      { to: "/admin/notices", label: "Notice Board", icon: <Megaphone {...ICON} />, soon: true },
      { to: "/admin/links", label: "Link Stack", icon: <Link2 {...ICON} />, soon: true },
      { to: "/admin/settings", label: "Settings", icon: <Settings {...ICON} /> },
    ],
  },
];

function SideNav({ onNavigate }: { onNavigate: () => void }) {
  const { pathname } = useLocation();
  const all = NAV.flatMap((g) => g.items);
  const live = all.filter((i) => !i.soon);
  const soon = all.filter((i) => i.soon);
  const isActive = (i: NavItem) =>
    i.end ? pathname === i.to || pathname === i.to + "/" : pathname.startsWith(i.to) || (!!i.also && pathname.startsWith(i.also));
  const soonActive = soon.some(isActive);
  const [more, setMore] = useState(false);
  const show = more || soonActive;
  const link = (i: NavItem) => {
    const active = isActive(i);
    return (
      <NavLink
        key={i.to}
        to={i.to}
        end={i.end}
        onClick={onNavigate}
        data-label={i.label}
        aria-current={active ? "page" : undefined}
        className={`navlink ${active ? "active" : ""} ${i.soon ? "soon" : ""}`}
      >
        {i.icon}
        <span className="nav-label">{i.label}</span>
      </NavLink>
    );
  };
  const settings = live.filter((i) => i.to === "/admin/settings");
  return (
    <nav className="sidenav" aria-label="Main">
      {live.filter((i) => i.to !== "/admin/settings").map(link)}
      <button type="button" className="navlink more-toggle" aria-expanded={show} onClick={() => setMore(!show)} data-label="Coming soon">
        <ChevronDown {...ICON} className={show ? "chev open" : "chev"} />
        <span className="nav-label">Coming soon</span>
        <span className="soon-tag">{soon.length}</span>
      </button>
      {show ? <div className="soon-list">{soon.map(link)}</div> : null}
      <div className="nav-spacer" />
      {settings.map(link)}
    </nav>
  );
}

function NewMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const items = [
    { to: "/admin/clients?new=1", label: "Client", icon: <Users {...ICON} /> },
    { to: "/admin/calendar?new=1", label: "Post", icon: <CalendarDays {...ICON} /> },
    { to: "/admin/tasks", label: "To-do", icon: <ListChecks {...ICON} /> },
  ];
  return (
    <div className="new-menu" ref={ref}>
      <button type="button" className="btn btn-primary new-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Plus size={18} strokeWidth={2} aria-hidden="true" />
        <span className="new-label">New</span>
      </button>
      {open ? (
        <div className="menu-pop glass" role="menu">
          {items.map((i) => (
            <NavLink key={i.label} to={i.to} role="menuitem" className="menu-item" onClick={() => setOpen(false)}>
              {i.icon}
              {i.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}

function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sam.nav.collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    try {
      localStorage.setItem("sam.nav.collapsed", collapsed ? "1" : "0");
    } catch {
      /* private mode: the setting just won't persist */
    }
  }, [collapsed]);

  return (
    <div className="app">
      <div className="mist" aria-hidden="true" />
      <div className={`window glass ${collapsed ? "collapsed" : ""} ${open ? "nav-open" : ""}`}>
        <header className="topbar">
          <button className="menu-btn mobile" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu {...ICON} />
          </button>
          <NavLink to="/admin" className="brand" aria-label="Studio AM home">
            <img src="/logo.png" alt="" width={40} height={40} />
            <span>Studio AM</span>
          </NavLink>
          <button className="menu-btn collapse" aria-label={collapsed ? "Expand menu" : "Collapse menu"} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <PanelLeftOpen {...ICON} /> : <PanelLeftClose {...ICON} />}
          </button>
          <div className="top-spacer" />
          <GlobalSearch />
          <NewMenu />
          <div className="who">
            <span className="avatar" aria-hidden="true">{initialsOf(user?.name ?? "")}</span>
            <span className="who-name">{user?.name}</span>
          </div>
          <button
            className="icon-btn"
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => {
              await logout();
              nav("/login");
            }}
          >
            <LogOut {...ICON} />
          </button>
        </header>
        <SideNav onNavigate={() => setOpen(false)} />
        <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />
        <main className="main" id="main">
          {children}
        </main>
      </div>
    </div>
  );
}

function ClientSwitcher({ current }: { current: string }) {
  const nav = useNavigate();
  const { data } = useLoad<AdminClient[]>("/api/admin/clients");
  if (!data) return null;
  const active = data.filter((c) => c.status !== "ARCHIVED" || c.slug === current);
  return (
    <label className="switcher">
      <span className="switcher-label">Switch client</span>
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

  if (loading)
    return (
      <AppShell>
        <Loading />
      </AppShell>
    );
  if (error || !data)
    return (
      <AppShell>
        <div className="center-note glass">
          <h1>We can't find that client</h1>
          <p>{error ?? "It may have been removed."}</p>
          <NavLink to="/admin/clients" className="text-link">
            Back to Client Directory
          </NavLink>
        </div>
      </AppShell>
    );

  const tabs = [
    { to: base, label: "Overview", end: true },
    { to: `${base}/calendar`, label: "Calendar" },
    { to: `${base}/files`, label: "Files" },
    { to: `${base}/links`, label: "Links" },
    { to: `${base}/tasks`, label: "To-do" },
    { to: `${base}/ideas`, label: "Ideas" },
    { to: `${base}/moodboard`, label: "Moodboard" },
    { to: `${base}/notices`, label: "Notices" },
  ];

  return (
    <PortalContext.Provider value={{ slug, home: data, reloadHome: reload, isAdmin, base }}>
      <AppShell>
        <div className="crumbs">
          <div className="crumb-trail">
            <NavLink to="/admin/clients">Client Directory</NavLink>
            <span aria-hidden="true">/</span>
            <strong>{data.client.name}</strong>
          </div>
          <ClientSwitcher current={slug} />
        </div>
        <nav className="client-tabs" aria-label={`${data.client.name} sections`}>
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? "active" : "")}>
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="panel">
          <Outlet />
        </div>
      </AppShell>
    </PortalContext.Provider>
  );
}

export function AdminShell() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
