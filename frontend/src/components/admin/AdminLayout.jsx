import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import api from "@/lib/api";
import AdminSidebar from "./AdminSidebar";
import AdminHeader from "./AdminHeader";

export default function AdminLayout() {
  const [projects, setProjects] = useState([]);

  const fetchProjects = () => {
    api.get("/projects").then((res) => setProjects(res.data)).catch(() => {});
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div className="flex h-screen w-full bg-background">
      <AdminSidebar projects={projects} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-6 md:p-8" data-testid="admin-main-content">
          <Outlet context={{ refreshProjects: fetchProjects }} />
        </main>
      </div>
    </div>
  );
}
