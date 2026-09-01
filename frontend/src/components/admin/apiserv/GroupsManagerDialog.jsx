import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import api from "@/lib/api";
import { formatError } from "@/lib/errors";
import { flattenGroupTree, getDescendantIds, computeGroupPrefix } from "@/lib/groupTree";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ConfirmDeleteButton from "@/components/admin/ConfirmDeleteButton";

export default function GroupsManagerDialog({ open, onOpenChange, kind, onChanged }) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingParentId, setEditingParentId] = useState("");
  const [newPathPrefix, setNewPathPrefix] = useState("");
  const [editingPathPrefix, setEditingPathPrefix] = useState("");

  const loadGroups = () => api.get("/firewall/groups", { params: { kind } }).then((res) => setGroups(res.data)).catch((e) => toast.error(formatError(e, t("common.error"))));

  useEffect(() => {
    if (open) loadGroups();
  }, [open, kind]);

  const flatGroups = flattenGroupTree(groups);

  const createGroup = async () => {
    if (!newName.trim()) {
      toast.error(t("firewall.name_required"));
      return;
    }
    try {
      await api.post("/firewall/groups", { name: newName, kind, parent_id: newParentId || null, path_prefix: newPathPrefix || "" });
      setNewName("");
      setNewParentId("");
      setNewPathPrefix("");
      loadGroups();
      onChanged?.();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const startEdit = (g) => { setEditingId(g.id); setEditingName(g.name); setEditingParentId(g.parent_id || ""); setEditingPathPrefix(g.path_prefix || ""); };
  const cancelEdit = () => { setEditingId(null); setEditingName(""); setEditingParentId(""); setEditingPathPrefix(""); };

  const saveEdit = async () => {
    if (!editingName.trim()) {
      toast.error(t("firewall.name_required"));
      return;
    }
    try {
      await api.put(`/firewall/groups/${editingId}`, { name: editingName, parent_id: editingParentId || null, path_prefix: editingPathPrefix || "" });
      cancelEdit();
      loadGroups();
      onChanged?.();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const deleteGroup = async (id) => {
    try {
      await api.delete(`/firewall/groups/${id}`);
      loadGroups();
      onChanged?.();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const parentOptionsFor = (excludeId) => {
    if (!excludeId) return flatGroups;
    const blocked = getDescendantIds(excludeId, groups);
    blocked.add(excludeId);
    return flatGroups.filter((g) => !blocked.has(g.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={`groups-manager-dialog-${kind}`}>
        <DialogHeader>
          <DialogTitle>{kind === "route" ? t("firewall.manage_route_groups") : t("firewall.manage_pipeline_groups")}</DialogTitle>
          <DialogDescription>{t("firewall.groups_help")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {flatGroups.length === 0 && (
            <p className="py-3 text-center text-xs text-muted-foreground" data-testid={`no-groups-text-${kind}`}>{t("firewall.no_groups")}</p>
          )}
          {flatGroups.map((g) => (
            <div key={g.id} className="border border-border p-2" data-testid={`group-row-${g.id}`} style={{ marginLeft: g.depth * 16 }}>
              {editingId === g.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input className="h-8 text-xs" value={editingName} onChange={(e) => setEditingName(e.target.value)} data-testid={`group-edit-input-${g.id}`} />
                  <Select value={editingParentId || "none"} onValueChange={(v) => setEditingParentId(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-8 w-48 rounded-sm text-xs" data-testid={`group-edit-parent-${g.id}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("firewall.no_parent_group")}</SelectItem>
                      {parentOptionsFor(g.id).map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>{"— ".repeat(opt.depth)}{opt.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {kind === "route" && (
                    <Input
                      className="h-8 w-40 text-xs font-mono" placeholder={t("firewall.path_prefix_placeholder")}
                      value={editingPathPrefix} onChange={(e) => setEditingPathPrefix(e.target.value)}
                      data-testid={`group-edit-prefix-${g.id}`}
                    />
                  )}
                  <Button size="icon" variant="ghost" onClick={saveEdit} data-testid={`group-save-${g.id}`}><Check className="h-3.5 w-3.5 text-primary" /></Button>
                  <Button size="icon" variant="ghost" onClick={cancelEdit} data-testid={`group-cancel-${g.id}`}><X className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <span className="text-sm">{g.depth > 0 ? "— " : ""}{g.name}</span>
                    {kind === "route" && computeGroupPrefix(g.id, groups) && (
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground" data-testid={`group-effective-prefix-${g.id}`}>
                        {computeGroupPrefix(g.id, groups)}/…
                      </span>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => startEdit(g)} data-testid={`group-edit-${g.id}`}><Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></Button>
                  <ConfirmDeleteButton testId={`group-delete-${g.id}`} onConfirm={() => deleteGroup(g.id)}>
                    <Button size="icon" variant="ghost"><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></Button>
                  </ConfirmDeleteButton>
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Input className="h-8 text-xs" placeholder={t("firewall.new_group_placeholder")} value={newName} onChange={(e) => setNewName(e.target.value)} data-testid={`new-group-input-${kind}`} />
            <Select value={newParentId || "none"} onValueChange={(v) => setNewParentId(v === "none" ? "" : v)}>
              <SelectTrigger className="h-8 w-48 rounded-sm text-xs" data-testid={`new-group-parent-${kind}`}><SelectValue placeholder={t("firewall.no_parent_group")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("firewall.no_parent_group")}</SelectItem>
                {flatGroups.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>{"— ".repeat(opt.depth)}{opt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {kind === "route" && (
              <Input
                className="h-8 w-40 text-xs font-mono" placeholder={t("firewall.path_prefix_placeholder")}
                value={newPathPrefix} onChange={(e) => setNewPathPrefix(e.target.value)}
                data-testid={`new-group-prefix-${kind}`}
              />
            )}
            <Button size="sm" variant="outline" className="gap-1.5 rounded-sm" onClick={createGroup} data-testid={`add-group-btn-${kind}`}>
              <Plus className="h-3.5 w-3.5" /> {t("common.add")}
            </Button>
          </div>
          {kind === "route" && (
            <p className="pt-1 text-xs text-muted-foreground">{t("firewall.path_prefix_help")}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
