import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, AppWindow, ArrowLeft, ListChecks } from "lucide-react";
import api, { API } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import AttachmentsList from "@/components/admin/AttachmentsList";

export default function ProjectDetail() {
  const { t } = useTranslation();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const outlet = useOutletContext();

  const [project, setProject] = useState(null);
  const [apps, setApps] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [appOpen, setAppOpen] = useState(false);
  const [appName, setAppName] = useState("");
  const [appDesc, setAppDesc] = useState("");

  const load = () => {
    api.get(`/projects/${projectId}`).then((res) => setProject(res.data));
    api.get(`/projects/${projectId}/apps`).then((res) => setApps(res.data));
    api.get(`/projects/${projectId}/attachments`).then((res) => setAttachments(res.data));
  };

  useEffect(() => { load(); }, [projectId]);

  const createApp = async () => {
    if (!appName.trim()) return;
    await api.post(`/projects/${projectId}/apps`, { name: appName, description: appDesc });
    toast.success(t("common.success"));
    setAppOpen(false); setAppName(""); setAppDesc("");
    load();
    outlet?.refreshProjects?.();
  };

  const uploadAttachment = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    await api.post(`/projects/${projectId}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    toast.success(t("common.success"));
    load();
  };

  const deleteAttachment = async (id) => { await api.delete(`/attachments/${id}`); load(); };

  const downloadAttachment = (a) => {
    window.open(`${API}/attachments/${a.id}/download`, "_blank");
  };

  if (!project) return null;
  const canManage = user?.portal_role === "super_admin";

  return (
    <div data-testid="project-detail-page">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          data-testid="back-to-projects-btn"
        >
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-sm"
          onClick={() => navigate(`/tasks?project=${projectId}`)}
          data-testid="view-project-tasks-btn"
        >
          <ListChecks className="h-3.5 w-3.5" /> {t("tasks_page.title")}
        </Button>
      </div>
      <h1 className="text-4xl font-black tracking-tighter" data-testid="project-title">{project.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{project.description}</p>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">{t("project_detail.apps_title")}</h3>
            {user?.portal_role === "super_admin" && (
              <Dialog open={appOpen} onOpenChange={setAppOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" data-testid="new-app-btn"><Plus className="h-4 w-4" /></Button>
                </DialogTrigger>
                <DialogContent data-testid="new-app-dialog">
                  <DialogHeader><DialogTitle>{t("project_detail.new_app")}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder={t("project_detail.app_name_placeholder")} value={appName} onChange={(e) => setAppName(e.target.value)} data-testid="app-name-input" />
                    <Textarea placeholder={t("common.description")} value={appDesc} onChange={(e) => setAppDesc(e.target.value)} data-testid="app-description-input" />
                  </div>
                  <DialogFooter><Button onClick={createApp} className="rounded-sm" data-testid="save-app-btn">{t("common.save")}</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
          {!apps.length ? (
            <p className="text-sm text-muted-foreground">{t("project_detail.no_apps")}</p>
          ) : (
            <div className="space-y-2">
              {apps.map((a) => (
                <div key={a.id} className="flex items-center gap-2 border border-border bg-background p-2.5" data-testid={`app-item-${a.id}`}>
                  <AppWindow className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium truncate">{a.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">{t("project_detail.attachments_title")}</h3>
          <AttachmentsList
            attachments={attachments}
            onUpload={uploadAttachment}
            onDelete={deleteAttachment}
            onDownload={downloadAttachment}
            canEdit={canManage}
          />
        </div>
      </div>
    </div>
  );
}
