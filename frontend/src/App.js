import "@/App.css";
import "@/i18n";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/admin/ProtectedRoute";
import AdminLayout from "@/components/admin/AdminLayout";
import Login from "@/pages/Login";
import ProjectsList from "@/pages/ProjectsList";
import ProjectDetail from "@/pages/ProjectDetail";
import UsersList from "@/pages/UsersList";
import GroupsList from "@/pages/GroupsList";
import TasksList from "@/pages/TasksList";
import AppLogs from "@/pages/AppLogs";
import AppSettings from "@/pages/AppSettings";
import AppUsers from "@/pages/AppUsers";
import AppDatabase from "@/pages/AppDatabase";
import AuditUsers from "@/pages/AuditUsers";
import AuthSettingsPage from "@/pages/AuthSettingsPage";
import ApiFirewallPage from "@/pages/ApiFirewallPage";
import ApiKeysPage from "@/pages/ApiKeysPage";
import FunctionsPage from "@/pages/FunctionsPage";
import { Toaster } from "@/components/ui/sonner";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<ProjectsList />} />
        <Route path="/projects/:projectId" element={<ProjectDetail />} />
        <Route path="/tasks" element={<TasksList />} />
        <Route path="/users" element={<UsersList />} />
        <Route path="/groups" element={<GroupsList />} />
        <Route path="/apps/:appId/logs" element={<AppLogs />} />
        <Route path="/apps/:appId/settings" element={<AppSettings />} />
        <Route path="/apps/:appId/users" element={<AppUsers />} />
        <Route path="/apps/:appId/database" element={<AppDatabase />} />
        <Route path="/security/audit-users" element={<AuditUsers />} />
        <Route path="/security/auth-settings" element={<AuthSettingsPage />} />
        <Route path="/security/api-firewall" element={<ApiFirewallPage />} />
        <Route path="/security/api-keys" element={<ApiKeysPage />} />
        <Route path="/computing/functions" element={<FunctionsPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
