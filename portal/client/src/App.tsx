import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { AdminShell, PortalShell } from "./components/Shell";
import { Loading } from "./components/ui";
import { AdminClientPage } from "./pages/AdminClient";
import { ClientsPage } from "./pages/AdminDashboard";
import { DashboardPage } from "./pages/Dashboard";
import { CalendarPage } from "./pages/Calendar";
import { HomePage } from "./pages/Home";
import { LoginPage, VerifyPage } from "./pages/Login";
import { MasterCalendarPage } from "./pages/MasterCalendar";
import { MoodboardPage } from "./pages/Moodboard";
import { ClientRecordsPage, RecordsPage } from "./components/Records";
import { SocialHub } from "./pages/Social";
import { useParams } from "react-router-dom";
import { SettingsPage } from "./pages/Settings";
import { TaskManagerPage } from "./pages/TaskManager";
import { TasksPage } from "./pages/Tasks";
import { TimePage } from "./pages/Time";

const ADMIN_MODULES: [string, string][] = [
  ["projects", "projects"], ["ideas", "ideas"], ["recurring", "recurring"], ["brand", "brand"], ["websites", "websites"], ["audits", "audits"], ["meetings", "meetings"],
  ["files", "files"], ["finance", "finance"], ["leads", "leads"], ["resources", "resources"], ["notices", "notices"], ["links", "links"],
];
const CLIENT_MODULES: [string, string][] = [
  ["projects", "projects"], ["brand", "brand"], ["websites", "websites"], ["audits", "audits"], ["meetings", "meetings"],
  ["files", "files"], ["finance", "finance"], ["ideas", "ideas"], ["links", "links"], ["notices", "notices"],
];
function ClientModule({ module }: { module: string }) {
  const { slug = "" } = useParams();
  return <ClientRecordsPage key={slug + module} module={module} slug={slug} />;
}
function ClientSocial() {
  const { slug = "" } = useParams();
  return <SocialHub key={slug} clientSlug={slug} />;
}

function Start() {
  const { user, client, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "ADMIN") return <Navigate to="/admin" replace />;
  return client ? <Navigate to={`/c/${client.slug}`} replace /> : <Navigate to="/login" replace />;
}

function Protected({ admin, children }: { admin?: boolean; children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "ADMIN") return <Navigate to="/" replace />;
  return children;
}

export function App() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/verify" element={<VerifyPage />} />
        <Route path="/" element={<Start />} />
        <Route
          path="/admin"
          element={
            <Protected admin>
              <AdminShell />
            </Protected>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="calendar" element={<MasterCalendarPage />} />
          <Route path="clients/:id" element={<AdminClientPage />} />
          <Route path="tasks" element={<TaskManagerPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="team" element={<Navigate to="/admin/settings" replace />} />
          {ADMIN_MODULES.map(([path, mod]) => (
            <Route key={path} path={path} element={<RecordsPage module={mod} />} />
          ))}
          <Route path="social" element={<SocialHub />} />
          <Route path="time" element={<TimePage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
        <Route
          path="/c/:slug"
          element={
            <Protected>
              <PortalShell />
            </Protected>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="moodboard" element={<MoodboardPage />} />
          <Route path="social" element={<ClientSocial />} />
          {CLIENT_MODULES.map(([path, mod]) => (
            <Route key={path} path={path} element={<ClientModule module={mod} />} />
          ))}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
