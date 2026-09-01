import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Settings2, Trash2, Users2 } from "lucide-react";
import api from "@/lib/api";
import { formatError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConfirmDeleteButton from "@/components/admin/ConfirmDeleteButton";
import ForbiddenState from "@/components/admin/ForbiddenState";
import { useAuth } from "@/contexts/AuthContext";

const SECTIONS = ["logs", "settings", "users", "db"];
const EMPTY_PERM = { logs: "none", settings: "none", users: "none", db: "none" };

export default function GroupsList() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const [groups, setGroups] = useState([]);
  const [apps, setApps] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permsDraft, setPermsDraft] = useState({});

  const load = () => {
    api.get("/groups").then((res) => setGroups(res.data)).catch(() => {});
    api.get("/projects").then((res) => {
      const allApps = res.data.flatMap((p) => (p.apps || []).map((a) => ({ ...a, project_name: p.name })));
      setApps(allApps);
    });
  };

  useEffect(() => { if (me?.portal_role === "super_admin") load(); }, [me]);

  if (me?.portal_role !== "super_admin") return <ForbiddenState />;

  const openNew = () => {
    setEditing(null);
    setName(""); setDescription("");
    const draft = {};
    apps.forEach((a) => { draft[a.id] = { app_id: a.id, ...EMPTY_PERM }; });
    setPermsDraft(draft);
    setOpen(true);
  };

  const openEdit = (g) => {
    setEditing(g);
    setName(g.name); setDescription(g.description || "");
    const draft = {};
    apps.forEach((a) => {
      const existing = (g.app_permissions || []).find((p) => p.app_id === a.id);
      draft[a.id] = existing || { app_id: a.id, ...EMPTY_PERM };
    });
    setPermsDraft(draft);
    setOpen(true);
  };

  const setPerm = (appId, section, value) => {
    setPermsDraft((prev) => ({
      ...prev,
      [appId]: { ...(prev[appId] || { app_id: appId, ...EMPTY_PERM }), [section]: value },
    }));
  };

  const save = async () => {
    if (!name.trim()) return;
    const payload = { name, description, app_permissions: Object.values(permsDraft) };
    try {
      if (editing) {
        await api.put(`/groups/${editing.id}`, payload);
      } else {
        await api.post("/groups", payload);
      }
      toast.success(t("common.success"));
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const deleteGroup = async (id) => {
    try {
      await api.delete(`/groups/${id}`);
      toast.success(t("common.success"));
      load();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  return (
    <div data-testid="groups-page">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-4xl font-black tracking-tighter">
            <Users2 className="h-8 w-8 text-primary" /> {t("groups.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("groups.subtitle")}</p>
        </div>
        <Button className="gap-2 rounded-sm" onClick={openNew} data-testid="new-group-btn">
          <Plus className="h-4 w-4" /> {t("groups.new_group")}
        </Button>
      </div>

      <div className="border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.description")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6" data-testid="no-groups-text">{t("groups.no_groups")}</TableCell></TableRow>
            )}
            {groups.map((g) => (
              <TableRow key={g.id} data-testid={`group-row-${g.id}`}>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{g.description}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 rounded-sm" onClick={() => openEdit(g)} data-testid={`edit-group-${g.id}`}>
                      <Settings2 className="h-3.5 w-3.5" /> {t("common.edit")}
                    </Button>
                    <ConfirmDeleteButton testId={`delete-group-${g.id}`} onConfirm={() => deleteGroup(g.id)}>
                      <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button>
                    </ConfirmDeleteButton>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[50.4rem]" data-testid="group-dialog">
          <DialogHeader><DialogTitle>{editing ? t("groups.edit_group") : t("groups.new_group")}</DialogTitle></DialogHeader>
          <div className="space-y-3 mb-4">
            <Input placeholder={t("common.name")} value={name} onChange={(e) => setName(e.target.value)} data-testid="group-name-input" />
            <Textarea placeholder={t("common.description")} value={description} onChange={(e) => setDescription(e.target.value)} data-testid="group-description-input" />
          </div>
          <div className="max-h-72 overflow-y-auto border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  {SECTIONS.map((s) => (
                    <TableHead key={s} className="text-xs">{t(`permissions.section_${s}`)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm font-medium">{a.name}</TableCell>
                    {SECTIONS.map((s) => (
                      <TableCell key={s}>
                        <Select value={permsDraft[a.id]?.[s] || "none"} onValueChange={(v) => setPerm(a.id, s, v)}>
                          <SelectTrigger className="h-8 w-24 rounded-sm text-xs" data-testid={`group-perm-${a.id}-${s}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("permissions.none")}</SelectItem>
                            <SelectItem value="view">{t("permissions.view")}</SelectItem>
                            <SelectItem value="edit">{t("permissions.edit")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={save} className="rounded-sm" data-testid="save-group-btn">{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
