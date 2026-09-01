import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Settings2 } from "lucide-react";
import api from "@/lib/api";
import { formatError } from "@/lib/errors";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import CheckEditor from "./CheckEditor";
import GroupsManagerDialog from "./GroupsManagerDialog";
import { flattenGroupTree } from "@/lib/groupTree";

function toEditorConfig(check) {
  const c = check.config || {};
  switch (check.type) {
    case "ip_whitelist":
    case "ip_blacklist":
      return { ips_text: (c.ips || []).join("\n") };
    case "required_fields":
      return { location: c.location || "body", fields_text: (c.fields || []).join("\n") };
    case "json_schema":
      return { schema_text: c.schema ? JSON.stringify(c.schema, null, 2) : "" };
    case "api_key":
      return {
        header_name: c.header_name || "X-API-Key",
        valid_keys_text: c.manual_keys ? c.manual_keys.join("\n") : (c.manual_keys_text ?? (c.valid_keys || []).join("\n")),
        selected_key_ids: c.selected_key_ids || [],
      };
    default:
      return { ...c };
  }
}

function toApiConfig(check, apiKeys) {
  const c = check.config || {};
  switch (check.type) {
    case "ip_whitelist":
    case "ip_blacklist":
      return { ips: (c.ips_text || "").split("\n").map((s) => s.trim()).filter(Boolean) };
    case "body_size_limit":
      return { max_bytes: Number(c.max_bytes) || 1000000 };
    case "required_fields":
      return { location: c.location || "body", fields: (c.fields_text || "").split("\n").map((s) => s.trim()).filter(Boolean) };
    case "json_schema": {
      let schema = {};
      try { schema = c.schema_text ? JSON.parse(c.schema_text) : {}; } catch { schema = {}; }
      return { schema };
    }
    case "api_key": {
      const manualKeys = (c.valid_keys_text || "").split("\n").map((s) => s.trim()).filter(Boolean);
      const selectedIds = c.selected_key_ids || [];
      return { header_name: c.header_name || "X-API-Key", manual_keys: manualKeys, selected_key_ids: selectedIds };
    }
    case "rate_limit":
      return { limit: Number(c.limit) || 60, window_seconds: Number(c.window_seconds) || 60, key: c.key || "ip" };
    default:
      return c;
  }
}

export default function PipelineFormDialog({ open, onOpenChange, editing, groups, onGroupsChanged, onSaved }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupId, setGroupId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [checks, setChecks] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [functions, setFunctions] = useState([]);
  const [onFailFunctionId, setOnFailFunctionId] = useState("");
  const [onFailMode, setOnFailMode] = useState("hook");
  const [groupsDialogOpen, setGroupsDialogOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get("/firewall/api-keys").then((res) => setApiKeys(res.data)).catch(() => setApiKeys([]));
    api.get("/firewall/functions").then((res) => setFunctions(res.data)).catch(() => setFunctions([]));
    if (editing) {
      setName(editing.name);
      setDescription(editing.description || "");
      setGroupId(editing.group_id || "");
      setEnabled(editing.enabled !== false);
      setChecks((editing.checks || []).map((c) => ({ ...c, config: toEditorConfig(c) })));
      setOnFailFunctionId(editing.on_fail_function_id || "");
      setOnFailMode(editing.on_fail_mode || "hook");
    } else {
      setName("");
      setDescription("");
      setGroupId("");
      setEnabled(true);
      setChecks([]);
      setOnFailFunctionId("");
      setOnFailMode("hook");
    }
  }, [open, editing]);

  const addCheck = () => setChecks((prev) => [...prev, { type: "required_fields", enabled: true, config: { location: "body", fields_text: "" } }]);
  const updateCheck = (index, updated) => setChecks((prev) => prev.map((c, i) => (i === index ? updated : c)));
  const removeCheck = (index) => setChecks((prev) => prev.filter((_, i) => i !== index));

  const save = async () => {
    if (!name.trim()) {
      toast.error(t("firewall.name_required"));
      return;
    }
    for (const c of checks) {
      if (c.type === "json_schema" && c.config.schema_text?.trim()) {
        try {
          JSON.parse(c.config.schema_text);
        } catch {
          toast.error(t("firewall.invalid_json_schema"));
          return;
        }
      }
    }
    const payload = {
      name, description, group_id: groupId || null, enabled,
      on_fail_function_id: onFailFunctionId || null,
      on_fail_mode: onFailMode || "hook",
      checks: checks.map((c) => ({ type: c.type, enabled: c.enabled, config: toApiConfig(c, apiKeys) })),
    };
    try {
      if (editing) await api.put(`/firewall/pipelines/${editing.id}`, payload);
      else await api.post("/firewall/pipelines", payload);
      toast.success(t("common.success"));
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[50.4rem] overflow-y-auto" data-testid="pipeline-dialog">
        <DialogHeader>
          <DialogTitle>{editing ? t("firewall.edit_pipeline") : t("firewall.new_pipeline")}</DialogTitle>
          <DialogDescription>{t("firewall.pipeline_form_help")}</DialogDescription>
        </DialogHeader>
        <div className="mb-4 space-y-3">
          <Input placeholder={t("common.name")} value={name} onChange={(e) => setName(e.target.value)} data-testid="pipeline-name-input" />
          <Textarea placeholder={t("common.description")} value={description} onChange={(e) => setDescription(e.target.value)} data-testid="pipeline-description-input" />
          <div className="flex items-center gap-2">
            <Select value={groupId || "none"} onValueChange={(v) => setGroupId(v === "none" ? "" : v)}>
              <SelectTrigger className="rounded-sm" data-testid="pipeline-group-select"><SelectValue placeholder={t("firewall.no_group")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("firewall.no_group")}</SelectItem>
                {flattenGroupTree(groups).map((g) => <SelectItem key={g.id} value={g.id}>{"— ".repeat(g.depth)}{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="icon" variant="outline" className="rounded-sm" onClick={() => setGroupsDialogOpen(true)} data-testid="manage-pipeline-groups-btn">
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="space-y-2.5">
          {checks.map((c, i) => (
            <CheckEditor key={i} check={c} index={i} onChange={updateCheck} onRemove={removeCheck} apiKeys={apiKeys} />
          ))}
          <Button variant="outline" size="sm" className="gap-1.5 rounded-sm" onClick={addCheck} data-testid="add-check-btn">
            <Plus className="h-3.5 w-3.5" /> {t("firewall.add_check")}
          </Button>
        </div>

        <div className="mt-4 space-y-2 border border-border p-3" data-testid="pipeline-on-fail-section">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("firewall.on_fail_title")}</p>
          <p className="text-xs text-muted-foreground">{t("firewall.on_fail_help")}</p>
          <Select value={onFailFunctionId || "none"} onValueChange={(v) => setOnFailFunctionId(v === "none" ? "" : v)}>
            <SelectTrigger className="rounded-sm" data-testid="pipeline-on-fail-function-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("firewall.on_fail_none")}</SelectItem>
              {functions.map((fn) => (
                <SelectItem key={fn.id} value={fn.id}>{fn.name} ({fn.runtime === "javascript" ? "JS" : "Py"})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onFailFunctionId && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t("firewall.on_fail_mode")}</p>
              <Select value={onFailMode} onValueChange={setOnFailMode}>
                <SelectTrigger className="rounded-sm" data-testid="pipeline-on-fail-mode-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hook">{t("firewall.on_fail_mode_hook")}</SelectItem>
                  <SelectItem value="override">{t("firewall.on_fail_mode_override")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">{t(`firewall.on_fail_mode_${onFailMode}_help`)}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={save} className="mt-4 rounded-sm" data-testid="save-pipeline-btn">{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <GroupsManagerDialog open={groupsDialogOpen} onOpenChange={setGroupsDialogOpen} kind="pipeline" onChanged={onGroupsChanged} />
    </>
  );
}
