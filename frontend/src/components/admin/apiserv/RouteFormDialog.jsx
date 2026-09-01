import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Trash2, Settings2, Layers, GripVertical, X } from "lucide-react";
import api from "@/lib/api";
import { formatError } from "@/lib/errors";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import GroupsManagerDialog from "./GroupsManagerDialog";
import { flattenGroupTree, computeGroupPrefix } from "@/lib/groupTree";

const METHODS = ["*", "GET", "POST", "PUT", "PATCH", "DELETE"];
const MIME_TYPES = ["application/json", "text/plain", "text/html", "application/xml", "text/xml", "application/octet-stream"];

const EMPTY_FORM = {
  name: "", description: "", group_id: "", method: "*", path_pattern: "", action: "pipeline", target_type: "app",
  target_app_id: "", target_base_url: "", target_route_id: "", function_id: "", strip_prefix: true, pipeline_ids: [], enabled: true,
  block_status_code: 403, block_message: "",
  response_status_code: 200, response_mime_type: "application/json", response_body: "",
};

const ROUTE_ACTIONS = ["pass", "pipeline", "block", "ignore", "respond", "function"];

export default function RouteFormDialog({
  open, onOpenChange, editing, apps, pipelines, groups, routes, functions, onGroupsChanged, onSaved,
  reviewInfo, reviewRoutes, onReviewSaved, onReviewApplyAll,
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY_FORM);
  const [headerRewrites, setHeaderRewrites] = useState([]);
  const [responseHeaders, setResponseHeaders] = useState([]);
  const [dragPipelineIndex, setDragPipelineIndex] = useState(null);
  const [groupsDialogOpen, setGroupsDialogOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({ ...EMPTY_FORM, ...editing, target_app_id: editing.target_app_id || "", target_route_id: editing.target_route_id || "", function_id: editing.function_id || "", pipeline_ids: editing.pipeline_ids || [], group_id: editing.group_id || "" });
      setHeaderRewrites(editing.header_rewrites || []);
      setResponseHeaders(editing.response_headers || []);
    } else {
      setForm(EMPTY_FORM);
      setHeaderRewrites([]);
      setResponseHeaders([]);
    }
  }, [open, editing]);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const addHeaderRewrite = () => setHeaderRewrites((prev) => [...prev, { action: "set", header_name: "", header_value: "" }]);
  const updateHeaderRewrite = (i, patch) => setHeaderRewrites((prev) => prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  const removeHeaderRewrite = (i) => setHeaderRewrites((prev) => prev.filter((_, idx) => idx !== i));

  const addResponseHeader = () => setResponseHeaders((prev) => [...prev, { name: "", value: "" }]);
  const updateResponseHeader = (i, patch) => setResponseHeaders((prev) => prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  const removeResponseHeader = (i) => setResponseHeaders((prev) => prev.filter((_, idx) => idx !== i));

  const movePipeline = (from, to) => setForm((prev) => {
    const ids = [...(prev.pipeline_ids || [])];
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    return { ...prev, pipeline_ids: ids };
  });

  const buildPayload = () => ({
    name: form.name, description: form.description || "", group_id: form.group_id || null,
    method: form.method, path_pattern: form.path_pattern,
    action: form.action || "pipeline",
    target_type: form.target_type,
    target_app_id: form.target_type === "app" ? (form.target_app_id || null) : null,
    target_base_url: form.target_type === "custom" ? (form.target_base_url || "") : "",
    target_route_id: form.target_type === "route" ? (form.target_route_id || null) : null,
    function_id: form.action === "function" ? (form.function_id || null) : null,
    strip_prefix: !!form.strip_prefix,
    pipeline_ids: form.action === "pipeline" ? (form.pipeline_ids || []) : [],
    block_status_code: Number(form.block_status_code) || 403,
    block_message: form.block_message || "",
    response_status_code: form.action === "respond" ? (Number(form.response_status_code) || 200) : 200,
    response_mime_type: form.action === "respond" ? (form.response_mime_type || "application/json") : "application/json",
    response_headers: form.action === "respond" ? responseHeaders.filter((h) => h.name?.trim()) : [],
    response_body: form.action === "respond" ? (form.response_body || "") : "",
    header_rewrites: headerRewrites.filter((h) => h.header_name?.trim()),
    enabled: !!form.enabled,
  });

  const save = async () => {
    if (!form.name?.trim() || !form.path_pattern?.trim()) {
      toast.error(t("firewall.name_path_required"));
      return;
    }
    try {
      if (editing) await api.put(`/firewall/routes/${editing.id}`, buildPayload());
      else await api.post("/firewall/routes", buildPayload());
      toast.success(t("common.success"));
      onSaved();
      if (reviewInfo) onReviewSaved();
      else onOpenChange(false);
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const applyToAll = async () => {
    if (!form.name?.trim() || !form.path_pattern?.trim()) {
      toast.error(t("firewall.name_path_required"));
      return;
    }
    const shared = buildPayload();
    try {
      await Promise.all((reviewRoutes || []).map((r) => {
        const payload = r.id === editing.id
          ? shared
          : { ...shared, name: r.name, description: r.description || "", method: r.method, path_pattern: r.path_pattern };
        return api.put(`/firewall/routes/${r.id}`, payload);
      }));
      toast.success(t("firewall.apply_to_all_success", { count: (reviewRoutes || []).length }));
      onSaved();
      onReviewApplyAll();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[43.2rem] overflow-y-auto" data-testid="route-dialog">
        <DialogHeader>
          <DialogTitle>
            {reviewInfo
              ? t("firewall.review_progress", { current: reviewInfo.index + 1, total: reviewInfo.total })
              : (editing ? t("firewall.edit_route") : t("firewall.new_route"))}
          </DialogTitle>
          <DialogDescription>{reviewInfo ? t("firewall.review_help") : t("firewall.route_form_help")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder={t("common.name")} value={form.name || ""} onChange={(e) => update({ name: e.target.value })} data-testid="route-name-input" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.method || "*"} onValueChange={(v) => update({ method: v })}>
              <SelectTrigger className="rounded-sm" data-testid="route-method-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => <SelectItem key={m} value={m}>{m === "*" ? t("firewall.any_method") : m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="/cars/*" value={form.path_pattern || ""} onChange={(e) => update({ path_pattern: e.target.value })} data-testid="route-path-pattern-input" />
          </div>

          <Textarea
            placeholder={t("common.description")}
            value={form.description || ""}
            onChange={(e) => update({ description: e.target.value })}
            className="text-xs" rows={2}
            data-testid="route-description-input"
          />

          <div className="flex items-center gap-2">
            <Select value={form.group_id || "none"} onValueChange={(v) => update({ group_id: v === "none" ? "" : v })}>
              <SelectTrigger className="rounded-sm" data-testid="route-group-select"><SelectValue placeholder={t("firewall.no_group")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("firewall.no_group")}</SelectItem>
                {flattenGroupTree(groups).map((g) => <SelectItem key={g.id} value={g.id}>{"— ".repeat(g.depth)}{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="icon" variant="outline" className="rounded-sm" onClick={() => setGroupsDialogOpen(true)} data-testid="manage-route-groups-btn">
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {form.group_id && computeGroupPrefix(form.group_id, groups) && (
            <p className="font-mono text-xs text-muted-foreground" data-testid="route-effective-path-hint">
              {t("firewall.effective_path")}: {computeGroupPrefix(form.group_id, groups)}{form.path_pattern || ""}
            </p>
          )}

          <div>
            <p className="mb-1.5 text-xs font-bold uppercase text-muted-foreground">{t("firewall.action_label")}</p>
            <Select value={form.action || "pipeline"} onValueChange={(v) => update({ action: v })}>
              <SelectTrigger className="rounded-sm" data-testid="route-action-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROUTE_ACTIONS.map((a) => <SelectItem key={a} value={a}>{t(`firewall.action_${a}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">{t(`firewall.action_${form.action || "pipeline"}_help`)}</p>
          </div>

          {form.action === "block" && (
            <div className="grid grid-cols-2 gap-2 border border-border p-2.5" data-testid="route-block-fields">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t("firewall.block_status_code")}</p>
                <Input type="number" min="400" max="599" value={form.block_status_code ?? 403} onChange={(e) => update({ block_status_code: e.target.value })} data-testid="route-block-status-input" />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t("firewall.block_message")}</p>
                <Input value={form.block_message || ""} onChange={(e) => update({ block_message: e.target.value })} data-testid="route-block-message-input" />
              </div>
            </div>
          )}

          {form.action === "respond" && (
            <div className="space-y-2 border border-border p-2.5" data-testid="route-respond-fields">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t("firewall.response_status_code")}</p>
                  <Input type="number" min="100" max="599" value={form.response_status_code ?? 200} onChange={(e) => update({ response_status_code: e.target.value })} data-testid="route-response-status-input" />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t("firewall.response_mime_type")}</p>
                  <Select value={form.response_mime_type || "application/json"} onValueChange={(v) => update({ response_mime_type: v })}>
                    <SelectTrigger className="rounded-sm" data-testid="route-response-mime-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MIME_TYPES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-bold uppercase text-muted-foreground">{t("firewall.response_headers")}</p>
                <div className="space-y-2">
                  {responseHeaders.map((h, i) => (
                    <div key={i} className="flex items-center gap-2" data-testid={`response-header-${i}`}>
                      <Input className="h-8 text-xs" placeholder="X-Header" value={h.name} onChange={(e) => updateResponseHeader(i, { name: e.target.value })} data-testid={`response-header-name-${i}`} />
                      <Input className="h-8 text-xs" placeholder={t("common.value")} value={h.value} onChange={(e) => updateResponseHeader(i, { value: e.target.value })} data-testid={`response-header-value-${i}`} />
                      <Button size="icon" variant="ghost" onClick={() => removeResponseHeader(i)} data-testid={`remove-response-header-${i}`}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-sm" onClick={addResponseHeader} data-testid="add-response-header-btn">
                    <Plus className="h-3.5 w-3.5" /> {t("firewall.add_response_header")}
                  </Button>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t("firewall.response_body")}</p>
                <Textarea
                  className="font-mono text-xs" rows={5}
                  value={form.response_body || ""}
                  onChange={(e) => update({ response_body: e.target.value })}
                  data-testid="route-response-body-textarea"
                />
              </div>
            </div>
          )}

          {form.action === "function" && (
            <div className="space-y-2 border border-border p-2.5" data-testid="route-function-fields">
              <p className="text-xs font-medium text-muted-foreground">{t("firewall.select_function")}</p>
              <Select value={form.function_id || ""} onValueChange={(v) => update({ function_id: v })}>
                <SelectTrigger className="rounded-sm" data-testid="route-function-select"><SelectValue placeholder={t("firewall.select_function")} /></SelectTrigger>
                <SelectContent>
                  {(functions || []).map((fn) => (
                    <SelectItem key={fn.id} value={fn.id}>{fn.name} ({fn.runtime === "javascript" ? "JS" : "Py"}){fn.enabled === false ? ` · ${t("common.disabled")}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(functions || []).length === 0 && (
                <p className="text-xs text-muted-foreground">{t("firewall.no_functions_hint")}</p>
              )}
            </div>
          )}

          {(form.action === "pass" || form.action === "pipeline") && (
            <>
              <Select value={form.target_type || "app"} onValueChange={(v) => update({ target_type: v })}>
                <SelectTrigger className="rounded-sm" data-testid="route-target-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="app">{t("firewall.target_app")}</SelectItem>
                  <SelectItem value="custom">{t("firewall.target_custom")}</SelectItem>
                  <SelectItem value="route">{t("firewall.target_route")}</SelectItem>
                </SelectContent>
              </Select>

              {form.target_type === "custom" ? (
                <Input placeholder="https://api.example.com" value={form.target_base_url || ""} onChange={(e) => update({ target_base_url: e.target.value })} data-testid="route-target-url-input" />
              ) : form.target_type === "route" ? (
                <Select value={form.target_route_id || ""} onValueChange={(v) => update({ target_route_id: v })}>
                  <SelectTrigger className="rounded-sm" data-testid="route-target-route-select"><SelectValue placeholder={t("firewall.select_target_route")} /></SelectTrigger>
                  <SelectContent>
                    {flattenGroupTree(groups).map((g) => {
                      const groupRoutes = (routes || []).filter((r) => r.id !== editing?.id && r.group_id === g.id);
                      if (groupRoutes.length === 0) return null;
                      return (
                        <SelectGroup key={g.id}>
                          <SelectLabel>{"— ".repeat(g.depth)}{g.name}</SelectLabel>
                          {groupRoutes.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.name} ({r.method} {r.path_pattern})</SelectItem>
                          ))}
                        </SelectGroup>
                      );
                    })}
                    {(() => {
                      const ungrouped = (routes || []).filter((r) => r.id !== editing?.id && !r.group_id);
                      if (ungrouped.length === 0) return null;
                      return (
                        <SelectGroup>
                          <SelectLabel>{t("firewall.no_group")}</SelectLabel>
                          {ungrouped.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.name} ({r.method} {r.path_pattern})</SelectItem>
                          ))}
                        </SelectGroup>
                      );
                    })()}
                  </SelectContent>
                </Select>
              ) : (
                <div>
                  <Select value={form.target_app_id || ""} onValueChange={(v) => update({ target_app_id: v })}>
                    <SelectTrigger className="rounded-sm" data-testid="route-target-app-select"><SelectValue placeholder={t("firewall.select_app")} /></SelectTrigger>
                    <SelectContent>
                      {apps.map((a) => <SelectItem key={a.id} value={a.id}>{a.project_name} / {a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {form.target_app_id && (
                    <p className="mt-1.5 text-xs text-muted-foreground" data-testid="route-target-app-prefix-hint">
                      {(() => {
                        const selectedApp = apps.find((a) => a.id === form.target_app_id);
                        return selectedApp?.backend_url
                          ? t("firewall.target_prefix_hint", { url: selectedApp.backend_url })
                          : t("firewall.no_backend_url");
                      })()}
                    </p>
                  )}
                </div>
              )}

              {form.action === "pipeline" && (
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase text-muted-foreground">{t("firewall.pipelines_priority")}</p>
                  <div className="space-y-1.5" data-testid="route-pipeline-list">
                    {(form.pipeline_ids || []).map((pid, idx) => {
                      const p = pipelines.find((x) => x.id === pid);
                      return (
                        <div
                          key={pid}
                          draggable
                          onDragStart={() => setDragPipelineIndex(idx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => { if (dragPipelineIndex !== null && dragPipelineIndex !== idx) movePipeline(dragPipelineIndex, idx); setDragPipelineIndex(null); }}
                          className="flex items-center gap-2 border border-border bg-muted/30 px-2 py-1.5"
                          data-testid={`route-pipeline-item-${pid}`}
                        >
                          <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" />
                          <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                          <span className="flex-1 truncate text-sm">{p?.name || pid}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => update({ pipeline_ids: form.pipeline_ids.filter((id) => id !== pid) })} data-testid={`remove-route-pipeline-${pid}`}>
                            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <Select value="" onValueChange={(v) => update({ pipeline_ids: [...(form.pipeline_ids || []), v] })}>
                    <SelectTrigger className="mt-1.5 rounded-sm" data-testid="route-add-pipeline-select"><SelectValue placeholder={t("firewall.add_pipeline")} /></SelectTrigger>
                    <SelectContent>
                      {pipelines.filter((p) => !(form.pipeline_ids || []).includes(p.id)).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(form.pipeline_ids || []).length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">{t("firewall.no_pipeline")}</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between border border-border p-2.5">
                <span className="text-xs font-medium">{t("firewall.strip_prefix")}</span>
                <Switch checked={!!form.strip_prefix} onCheckedChange={(v) => update({ strip_prefix: v })} data-testid="route-strip-prefix-switch" />
              </div>

              <div>
                <p className="mb-1.5 text-xs font-bold uppercase text-muted-foreground">{t("firewall.header_rewrites")}</p>
                <div className="space-y-2">
                  {headerRewrites.map((h, i) => (
                    <div key={i} className="flex items-center gap-2" data-testid={`header-rewrite-${i}`}>
                      <Select value={h.action} onValueChange={(v) => updateHeaderRewrite(i, { action: v })}>
                        <SelectTrigger className="h-8 w-24 rounded-sm text-xs" data-testid={`header-rewrite-action-${i}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="set">{t("firewall.header_set")}</SelectItem>
                          <SelectItem value="remove">{t("firewall.header_remove")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input className="h-8 text-xs" placeholder="X-Header" value={h.header_name} onChange={(e) => updateHeaderRewrite(i, { header_name: e.target.value })} data-testid={`header-rewrite-name-${i}`} />
                      {h.action === "set" && (
                        <Input className="h-8 text-xs" placeholder={t("common.value")} value={h.header_value} onChange={(e) => updateHeaderRewrite(i, { header_value: e.target.value })} data-testid={`header-rewrite-value-${i}`} />
                      )}
                      <Button size="icon" variant="ghost" onClick={() => removeHeaderRewrite(i)} data-testid={`header-rewrite-remove-${i}`}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-sm" onClick={addHeaderRewrite} data-testid="add-header-rewrite-btn">
                    <Plus className="h-3.5 w-3.5" /> {t("firewall.add_header_rewrite")}
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-between border border-border p-2.5">
            <span className="text-xs font-medium">{t("common.enabled")}</span>
            <Switch checked={!!form.enabled} onCheckedChange={(v) => update({ enabled: v })} data-testid="route-enabled-switch" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {reviewInfo && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-1.5 rounded-sm" data-testid="apply-to-all-routes-btn">
                  <Layers className="h-3.5 w-3.5" /> {t("firewall.apply_to_all")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("firewall.apply_to_all_confirm_title")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("firewall.apply_to_all_confirm_desc", { count: (reviewRoutes || []).length })}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="apply-to-all-routes-cancel">{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={applyToAll} data-testid="apply-to-all-routes-confirm">{t("firewall.apply_to_all")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button onClick={save} className="rounded-sm" data-testid="save-route-btn">
            {reviewInfo ? t("firewall.save_and_continue") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <GroupsManagerDialog open={groupsDialogOpen} onOpenChange={setGroupsDialogOpen} kind="route" onChanged={onGroupsChanged} />
    </>
  );
}
