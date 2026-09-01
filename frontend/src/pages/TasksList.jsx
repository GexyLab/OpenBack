import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, ListChecks } from "lucide-react";
import api from "@/lib/api";
import { formatError } from "@/lib/errors";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import TaskList from "@/components/admin/TaskList";

export default function TasksList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = user?.portal_role === "super_admin";
  const [searchParams] = useSearchParams();

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [filterProject, setFilterProject] = useState(searchParams.get("project") || "all");
  const [open, setOpen] = useState(false);
  const [taskProjectId, setTaskProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const loadProjects = () => api.get("/projects").then((res) => setProjects(res.data));
  const loadTasks = () => {
    const params = filterProject !== "all" ? { project_id: filterProject } : {};
    api.get("/tasks", { params }).then((res) => setTasks(res.data));
  };

  useEffect(() => { loadProjects(); }, []);
  useEffect(() => { loadTasks(); }, [filterProject]);

  const createTask = async () => {
    if (!title.trim() || !taskProjectId) return;
    try {
      await api.post(`/projects/${taskProjectId}/tasks`, { title, description });
      toast.success(t("common.success"));
      setOpen(false); setTitle(""); setDescription(""); setTaskProjectId("");
      loadTasks();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const cycleStatus = async (task) => {
    const order = ["todo", "in_progress", "done"];
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    await api.put(`/tasks/${task.id}`, { ...task, status: next });
    loadTasks();
  };

  const deleteTask = async (id) => { await api.delete(`/tasks/${id}`); loadTasks(); };

  return (
    <div data-testid="tasks-page">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-4xl font-black tracking-tighter">
            <ListChecks className="h-8 w-8 text-primary" /> {t("tasks_page.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("tasks_page.subtitle")}</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-sm" data-testid="new-task-btn">
                <Plus className="h-4 w-4" /> {t("project_detail.new_task")}
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="new-task-dialog">
              <DialogHeader><DialogTitle>{t("project_detail.new_task")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Select value={taskProjectId} onValueChange={setTaskProjectId}>
                  <SelectTrigger data-testid="task-project-select" className="rounded-sm">
                    <SelectValue placeholder={t("tasks_page.select_project")} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder={t("project_detail.task_title_placeholder")} value={title} onChange={(e) => setTitle(e.target.value)} data-testid="task-title-input" />
                <Textarea placeholder={t("project_detail.task_description_placeholder")} value={description} onChange={(e) => setDescription(e.target.value)} data-testid="task-description-input" />
              </div>
              <DialogFooter><Button onClick={createTask} className="rounded-sm" data-testid="save-task-btn">{t("common.save")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="mb-4">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-64 rounded-sm" data-testid="task-filter-project-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("tasks_page.filter_all_projects")}</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border bg-card p-5">
        <TaskList tasks={tasks} onCycleStatus={cycleStatus} onDelete={deleteTask} canEdit={canManage} showProject />
      </div>
    </div>
  );
}
