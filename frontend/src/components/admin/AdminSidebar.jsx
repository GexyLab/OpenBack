import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FolderKanban, Users, ScrollText, Settings, UserCog, Database, Boxes, ListChecks, Users2,
  ShieldCheck, ChevronDown, History, KeyRound, Network, KeySquare, Cpu, FunctionSquare,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const APP_SECTIONS = [
  { key: "logs", path: "logs", icon: ScrollText, labelKey: "nav.logs" },
  { key: "settings", path: "settings", icon: Settings, labelKey: "nav.settings" },
  { key: "users", path: "users", icon: UserCog, labelKey: "nav.app_users" },
  { key: "db", path: "database", icon: Database, labelKey: "nav.database" },
];

function canSeeSection(user, appId, sectionKey) {
  if (!user) return false;
  if (user.portal_role === "super_admin") return true;
  const perm = (user.app_permissions || []).find((p) => p.app_id === appId);
  return perm && perm[sectionKey] && perm[sectionKey] !== "none";
}

const navLinkClasses = ({ isActive }) =>
  `flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors duration-150 ease-in-out ${
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-foreground"
  }`;

export default function AdminSidebar({ projects }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [securityOpen, setSecurityOpen] = useState(true);

  return (
    <aside
      data-testid="admin-sidebar"
      className="flex h-screen w-64 flex-col border-r border-border bg-card overflow-y-auto"
    >
      <div
        className="flex items-center gap-2 border-b border-border px-5 py-5 cursor-pointer"
        onClick={() => navigate("/")}
        data-testid="sidebar-logo"
      >
        <Boxes className="h-6 w-6 text-primary" strokeWidth={2.5} />
        <span className="font-black tracking-tight text-lg">GexyLab</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-6">
        <div>
          <h3 className="px-3 pb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {t("nav.general")}
          </h3>
          <div className="space-y-0.5">
            <NavLink to="/" end className={navLinkClasses} data-testid="nav-projects">
              <FolderKanban className="h-4 w-4" />
              {t("nav.projects")}
            </NavLink>
            <NavLink to="/tasks" className={navLinkClasses} data-testid="nav-tasks">
              <ListChecks className="h-4 w-4" />
              {t("nav.tasks")}
            </NavLink>
            {user?.portal_role === "super_admin" && (
              <NavLink to="/users" className={navLinkClasses} data-testid="nav-users">
                <Users className="h-4 w-4" />
                {t("nav.users")}
              </NavLink>
            )}
            {user?.portal_role === "super_admin" && (
              <NavLink to="/groups" className={navLinkClasses} data-testid="nav-groups">
                <Users2 className="h-4 w-4" />
                {t("nav.groups")}
              </NavLink>
            )}
          </div>
        </div>

        {user?.portal_role === "super_admin" && (
          <div>
            <button
              onClick={() => setSecurityOpen((o) => !o)}
              data-testid="nav-security-toggle"
              className="flex w-full items-center justify-between px-3 pb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> {t("nav.security")}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${securityOpen ? "rotate-180" : ""}`} />
            </button>
            {securityOpen && (
              <div className="space-y-0.5">
                <NavLink to="/security/audit-users" className={navLinkClasses} data-testid="nav-audit-users">
                  <History className="h-4 w-4" />
                  {t("nav.audit_users")}
                </NavLink>
                <NavLink to="/security/auth-settings" className={navLinkClasses} data-testid="nav-auth-settings">
                  <KeyRound className="h-4 w-4" />
                  {t("nav.auth_settings")}
                </NavLink>
                <NavLink to="/security/api-keys" className={navLinkClasses} data-testid="nav-api-keys">
                  <KeySquare className="h-4 w-4" />
                  {t("nav.api_keys")}
                </NavLink>
              </div>
            )}
          </div>
        )}

        {user?.portal_role === "super_admin" && (
          <div>
            <h3 className="flex items-center gap-1.5 px-3 pb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              <Network className="h-3.5 w-3.5" /> {t("nav.api_gateway")}
            </h3>
            <div className="space-y-0.5">
              <NavLink to="/security/api-firewall" className={navLinkClasses} data-testid="nav-api-firewall">
                <Network className="h-4 w-4" />
                {t("nav.api_gateway_routes")}
              </NavLink>
            </div>
          </div>
        )}

        {user?.portal_role === "super_admin" && (
          <div>
            <h3 className="flex items-center gap-1.5 px-3 pb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              <Cpu className="h-3.5 w-3.5" /> {t("nav.computing")}
            </h3>
            <div className="space-y-0.5">
              <NavLink to="/computing/functions" className={navLinkClasses} data-testid="nav-functions">
                <FunctionSquare className="h-4 w-4" />
                {t("nav.functions")}
              </NavLink>
            </div>
          </div>
        )}

        {projects?.map((project) => (
          <div key={project.id} data-testid={`sidebar-project-group-${project.id}`}>
            <h3 className="px-3 pb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground truncate">
              {project.name}
            </h3>
            <div className="space-y-3">
              {(project.apps || []).map((app) => (
                <div key={app.id}>
                  <p className="px-3 pb-1 text-[11px] font-semibold text-foreground/70 truncate">{app.name}</p>
                  <div className="space-y-0.5">
                    {APP_SECTIONS.filter((s) => canSeeSection(user, app.id, s.key)).map((s) => (
                      <NavLink
                        key={s.key}
                        to={`/apps/${app.id}/${s.path}`}
                        className={navLinkClasses}
                        data-testid={`nav-app-${app.id}-${s.key}`}
                      >
                        <s.icon className="h-4 w-4" />
                        {t(s.labelKey)}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
