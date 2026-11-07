import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { AdminShell, PortalShell } from "./components/Shell";
import { Loading } from "./components/ui";
import { AdminClientPage } from "./pages/AdminClient";
import { ClientsPage } from "./pages/AdminDashboard";
import { DashboardPage } from "./pages/Dashboard";
import { CalendarPage } from "./pages/Calendar";
import { FilesPage } from "./pages/Files";
import { HomePage } from "./pages/Home";
import { IdeasPage } from "./pages/Ideas";
import { LinksPage } from "./pages/Links";
import { LoginPage, VerifyPage } from "./pages/Login";
import { MasterCalendarPage } from "./pages/MasterCalendar";
import { MoodboardPage } from "./pages/Moodboard";
import { NoticesPage } from "./pages/Notices";
import { PlannedPage } from "./pages/Planned";
import { SettingsPage } from "./pages/Settings";
import { TaskManagerPage } from "./pages/TaskManager";
import { TasksPage } from "./pages/Tasks";

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
          <Route path="*" element={<PlannedPage />} />
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
          <Route path="files" element={<FilesPage />} />
          <Route path="links" element={<LinksPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="ideas" element={<IdeasPage />} />
          <Route path="moodboard" element={<MoodboardPage />} />
          <Route path="notices" element={<NoticesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
