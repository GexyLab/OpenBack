import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { Plus, FolderKanban, Trash2, ArrowRight, AlertTriangle } from "lucide-react";
import api from "@/lib/api";
import { formatError } from "@/lib/errors";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import ConfirmDeleteButton from "@/components/admin/ConfirmDeleteButton";

export default function ProjectsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const outlet = useOutletContext();
  const [projects, setProjects] = useState([]);
  const [overdueTasks, setOverdueTasks] = useState([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const load = () => api.get("/projects").then((res) => setProjects(res.data));

  const loadOverdue = () => {
    api.get("/tasks").then((res) => {
      const now = new Date();
      const overdue = res.data.filter((t) => t.due_date && new Date(t.due_date) < now && t.status !== "done");
      setOverdueTasks(overdue);
    }).catch(() => setOverdueTasks([]));
  };

  useEffect(() => { load(); loadOverdue(); }, []);

  const createProject = async () => {
    if (!name.trim()) return;
    try {
      await api.post("/projects", { name, description });
      toast.success(t("common.success"));
      setOpen(false);
      setName("");
      setDescription("");
      load();
      outlet?.refreshProjects?.();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const deleteProject = async (id) => {
    await api.delete(`/projects/${id}`);
    load();
    outlet?.refreshProjects?.();
  };

  return (
    <div data-testid="projects-page">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter">{t("projects.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("projects.subtitle")}</p>
        </div>
        {user?.portal_role === "super_admin" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-sm" data-testid="new-project-btn">
                <Plus className="h-4 w-4" /> {t("projects.new_project")}
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="new-project-dialog">
              <DialogHeader>
                <DialogTitle>{t("projects.create_dialog_title")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder={t("projects.name_placeholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="project-name-input"
                />
                <Textarea
                  placeholder={t("projects.description_placeholder")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="project-description-input"
                />
              </div>
              <DialogFooter>
                <Button onClick={createProject} className="rounded-sm" data-testid="save-project-btn">
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="mb-8 border border-border bg-card p-5" data-testid="overdue-tasks-widget">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em]">
            <AlertTriangle className={`h-4 w-4 ${overdueTasks.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            {t("dashboard.overdue_title")}
            {overdueTasks.length > 0 && (
              <Badge variant="destructive" className="rounded-sm" data-testid="overdue-tasks-count">
                {overdueTasks.length}
              </Badge>
            )}
          </h2>
          {overdueTasks.length > 0 && (
            <button
              onClick={() => navigate("/tasks")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              data-testid="overdue-tasks-view-all"
            >
              {t("dashboard.overdue_view_all")} <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
        {overdueTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="overdue-tasks-empty">{t("dashboard.overdue_empty")}</p>
        ) : (
          <div className="space-y-1.5">
            {overdueTasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                onClick={() => navigate(`/tasks?project=${task.project_id}`)}
                className="flex cursor-pointer items-center justify-between border border-border bg-background px-3 py-2 text-sm transition-colors duration-150 hover:border-primary"
                data-testid={`overdue-task-${task.id}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate font-medium">{task.title}</span>
                  <Badge variant="outline" className="rounded-sm text-[10px] shrink-0">{task.project_name}</Badge>
                </div>
                <span className="shrink-0 text-xs text-destructive">{task.due_date?.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="no-projects-text">{t("projects.no_projects")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className="group border border-border bg-card p-5 cursor-pointer transition-colors duration-150 hover:border-primary"
              onClick={() => navigate(`/projects/${p.id}`)}
              data-testid={`project-card-${p.id}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <FolderKanban className="h-5 w-5 text-primary" />
                {user?.portal_role === "super_admin" && (
                  <ConfirmDeleteButton
                    testId={`delete-project-${p.id}`}
                    description={t("projects.delete_confirm")}
                    onConfirm={() => deleteProject(p.id)}
                  >
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </ConfirmDeleteButton>
                )}
              </div>
              <h2 className="text-xl font-bold">{p.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>{p.apps_count} {t("projects.apps")} · {p.tasks_count} {t("projects.tasks")}</span>
                <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
