import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Trash2, Settings2, Network, Send, Download, Upload } from "lucide-react";
import api from "@/lib/api";
import { formatError } from "@/lib/errors";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConfirmDeleteButton from "@/components/admin/ConfirmDeleteButton";
import ForbiddenState from "@/components/admin/ForbiddenState";
import Pagination from "@/components/admin/Pagination";
import RouteFormDialog from "@/components/admin/apiserv/RouteFormDialog";
import PipelineFormDialog from "@/components/admin/apiserv/PipelineFormDialog";
import TestRouteDialog from "@/components/admin/apiserv/TestRouteDialog";
import GroupsManagerDialog from "@/components/admin/apiserv/GroupsManagerDialog";
import GroupTreeRows from "@/components/admin/apiserv/GroupTreeRows";
import CsvImportMappingDialog from "@/components/admin/apiserv/CsvImportMappingDialog";
import BulkActionsBar from "@/components/admin/apiserv/BulkActionsBar";
import { flattenGroupTree, computeGroupPrefix } from "@/lib/groupTree";

const ACTION_BADGE_CLASS = {
  pass: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30",
  pipeline: "bg-primary/15 text-primary border border-primary/30",
  block: "bg-destructive/15 text-destructive border border-destructive/30",
  ignore: "bg-muted text-muted-foreground border border-border",
  respond: "bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30",
  function: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30",
};

export default function ApiFirewallPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [apps, setApps] = useState([]);
  const [functions, setFunctions] = useState([]);
  const [logDetail, setLogDetail] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLimit, setLogsLimit] = useState(25);
  const [logsFilter, setLogsFilter] = useState("all");
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [pipelineDialogOpen, setPipelineDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [editingPipeline, setEditingPipeline] = useState(null);
  const [testingRoute, setTestingRoute] = useState(null);
  const [settings, setSettings] = useState(null);
  const [routeGroups, setRouteGroups] = useState([]);
  const [pipelineGroups, setPipelineGroups] = useState([]);
  const [routeGroupFilter, setRouteGroupFilter] = useState("all");
  const [pipelineGroupFilter, setPipelineGroupFilter] = useState("all");
  const [routeGroupsDialogOpen, setRouteGroupsDialogOpen] = useState(false);
  const [pipelineGroupsDialogOpen, setPipelineGroupsDialogOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const toggleGroup = (key) => setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  const [importQueue, setImportQueue] = useState([]);
  const [importIndex, setImportIndex] = useState(0);
  const [importReviewActive, setImportReviewActive] = useState(false);
  const [pendingCsvFile, setPendingCsvFile] = useState(null);
  const [csvMappingOpen, setCsvMappingOpen] = useState(false);
  const [selectedRouteIds, setSelectedRouteIds] = useState(new Set());
  const [selectedPipelineIds, setSelectedPipelineIds] = useState(new Set());

  const loadRoutes = () => api.get("/firewall/routes").then((res) => setRoutes(res.data));
  const loadPipelines = () => api.get("/firewall/pipelines").then((res) => setPipelines(res.data));
  const loadFunctions = () => api.get("/firewall/functions").then((res) => setFunctions(res.data)).catch(() => setFunctions([]));
  const loadApps = () => api.get("/projects").then((res) => {
    setApps(res.data.flatMap((p) => (p.apps || []).map((a) => ({ ...a, project_name: p.name }))));
  });
  const loadLogs = () => {
    const params = { page: logsPage, limit: logsLimit };
    if (logsFilter !== "all") params.blocked = logsFilter === "blocked";
    api.get("/firewall/logs", { params }).then((res) => { setLogs(res.data.logs); setLogsTotal(res.data.total); });
  };
  const loadSettings = () => api.get("/firewall/settings").then((res) => setSettings(res.data));
  const loadRouteGroups = () => api.get("/firewall/groups", { params: { kind: "route" } }).then((res) => setRouteGroups(res.data));
  const loadPipelineGroups = () => api.get("/firewall/groups", { params: { kind: "pipeline" } }).then((res) => setPipelineGroups(res.data));

  useEffect(() => {
    if (user?.portal_role === "super_admin") {
      loadRoutes(); loadPipelines(); loadApps(); loadSettings(); loadRouteGroups(); loadPipelineGroups(); loadFunctions();
    }
  }, [user]);
  useEffect(() => {
    if (user?.portal_role === "super_admin") loadLogs();
  }, [user, logsPage, logsLimit, logsFilter]);

  const [highlightedRouteId, setHighlightedRouteId] = useState(null);
  useEffect(() => {
    if (!highlightedRouteId) return;
    const el = document.querySelector(`[data-testid="route-row-${highlightedRouteId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setHighlightedRouteId(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightedRouteId]);

  if (user?.portal_role !== "super_admin") return <ForbiddenState />;

  const toggleRouteEnabled = async (route, enabled) => {
    try {
      await api.put(`/firewall/routes/${route.id}`, { ...route, enabled });
      loadRoutes();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const togglePipelineEnabled = async (pipeline, enabled) => {
    try {
      await api.put(`/firewall/pipelines/${pipeline.id}`, { ...pipeline, enabled });
      loadPipelines();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const deleteRoute = async (id) => {
    try {
      await api.delete(`/firewall/routes/${id}`);
      toast.success(t("common.success"));
      loadRoutes();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const importRoutesCsv = async (file, mapping) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mapping", JSON.stringify(mapping || {}));
    try {
      const res = await api.post("/firewall/routes/import-csv", formData);
      const { imported, skipped } = res.data;
      loadRoutes();
      if (imported.length === 0) {
        toast.error(t("firewall.import_none"));
        return;
      }
      toast.success(t("firewall.import_success", { count: imported.length }) + (skipped > 0 ? ` (${t("firewall.import_skipped", { count: skipped })})` : ""));
      setImportQueue(imported);
      setImportIndex(0);
      setEditingRoute(imported[0]);
      setImportReviewActive(true);
      setRouteDialogOpen(true);
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const advanceImportReview = () => {
    loadRoutes();
    const next = importIndex + 1;
    if (next < importQueue.length) {
      setImportIndex(next);
      setEditingRoute(importQueue[next]);
    } else {
      finishImportReview();
    }
  };

  const finishImportReview = () => {
    loadRoutes();
    setImportReviewActive(false);
    setImportQueue([]);
    setImportIndex(0);
    setRouteDialogOpen(false);
    setEditingRoute(null);
  };

  const deletePipeline = async (id) => {
    try {
      await api.delete(`/firewall/pipelines/${id}`);
      toast.success(t("common.success"));
      loadPipelines();
      loadRoutes();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const saveSettings = async () => {
    try {
      const res = await api.put("/firewall/settings", { log_retention_days: Number(settings.log_retention_days) });
      setSettings(res.data);
      toast.success(t("common.success"));
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const pipelineName = (id) => pipelines.find((p) => p.id === id)?.name || t("firewall.no_pipeline");
  const functionName = (id) => functions.find((f) => f.id === id)?.name || "—";
  const targetLabel = (r) => (r.target_type === "app"
    ? (apps.find((a) => a.id === r.target_app_id)?.name || "—")
    : r.target_type === "route"
    ? (routes.find((x) => x.id === r.target_route_id)?.name || "—")
    : (r.target_base_url || "—"));
  const targetRouteGroupName = (r) => {
    if (r.target_type !== "route") return null;
    const targetRoute = routes.find((x) => x.id === r.target_route_id);
    if (!targetRoute?.group_id) return null;
    return routeGroups.find((g) => g.id === targetRoute.group_id)?.name || null;
  };
  const targetPrefix = (r) => (r.target_type === "app"
    ? (apps.find((a) => a.id === r.target_app_id)?.backend_url || "")
    : "");

  const goToTargetRoute = (targetRouteId) => {
    const targetRoute = routes.find((r) => r.id === targetRouteId);
    if (!targetRoute) return;
    setRouteGroupFilter("all");
    if (targetRoute.group_id) {
      const ancestorIds = [];
      let gid = targetRoute.group_id;
      while (gid) {
        ancestorIds.push(gid);
        gid = routeGroups.find((g) => g.id === gid)?.parent_id || null;
      }
      setCollapsedGroups((prev) => {
        const next = { ...prev };
        ancestorIds.forEach((id) => { delete next[`route:${id}`]; });
        return next;
      });
    }
    setHighlightedRouteId(targetRouteId);
  };
  const buildGroupTree = (items, groups, filterVal) => {
    const byId = new Map(groups.map((g) => [g.id, g]));
    const childrenOf = new Map();
    groups.forEach((g) => {
      const key = g.parent_id && byId.has(g.parent_id) ? g.parent_id : "root";
      if (!childrenOf.has(key)) childrenOf.set(key, []);
      childrenOf.get(key).push(g);
    });
    const isUngrouped = (i) => !i.group_id || !byId.has(i.group_id);
    const buildNode = (group, depth) => {
      const directItems = items.filter((i) => i.group_id === group.id);
      const children = (childrenOf.get(group.id) || []).map((child) => buildNode(child, depth + 1));
      const totalCount = directItems.length + children.reduce((sum, c) => sum + c.totalCount, 0);
      const pathPrefix = computeGroupPrefix(group.id, groups) || null;
      return { id: group.id, name: group.name, depth, items: directItems, children, totalCount, pathPrefix };
    };
    if (filterVal === "none") {
      const ungrouped = items.filter(isUngrouped);
      return [{ id: "none", name: t("firewall.no_group"), depth: 0, items: ungrouped, children: [], totalCount: ungrouped.length }];
    }
    if (filterVal !== "all") {
      const g = byId.get(filterVal);
      return g ? [buildNode(g, 0)] : [];
    }
    const roots = (childrenOf.get("root") || []).map((g) => buildNode(g, 0));
    const ungrouped = items.filter(isUngrouped);
    if (ungrouped.length > 0) roots.push({ id: "none", name: t("firewall.no_group"), depth: 0, items: ungrouped, children: [], totalCount: ungrouped.length });
    return roots;
  };
  const routeTree = buildGroupTree(routes, routeGroups, routeGroupFilter);
  const pipelineTree = buildGroupTree(pipelines, pipelineGroups, pipelineGroupFilter);

  const flattenTreeItems = (tree) => tree.flatMap((node) => [...node.items, ...flattenTreeItems(node.children)]);
  const pipelineTreeItems = flattenTreeItems(pipelineTree);
  const allPipelinesSelected = pipelineTreeItems.length > 0 && pipelineTreeItems.every((p) => selectedPipelineIds.has(p.id));

  const toggleRouteSelected = (id) => setSelectedRouteIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const togglePipelineSelected = (id) => setSelectedPipelineIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleSelectAllPipelines = (checked) => setSelectedPipelineIds(checked ? new Set(pipelineTreeItems.map((p) => p.id)) : new Set());

  const routeGroupCheckState = (node) => {
    const items = flattenTreeItems([node]);
    if (items.length === 0) return false;
    const selectedCount = items.filter((r) => selectedRouteIds.has(r.id)).length;
    if (selectedCount === 0) return false;
    if (selectedCount === items.length) return true;
    return "indeterminate";
  };
  const toggleRouteGroupSelected = (node, checked) => {
    const items = flattenTreeItems([node]);
    setSelectedRouteIds((prev) => {
      const next = new Set(prev);
      items.forEach((r) => { if (checked) next.add(r.id); else next.delete(r.id); });
      return next;
    });
  };

  const bulkRouteAction = async (action, group_id) => {
    try {
      const res = await api.post("/firewall/routes/bulk-action", { ids: Array.from(selectedRouteIds), action, group_id });
      toast.success(t("firewall.bulk_action_success", { count: res.data.updated }));
      setSelectedRouteIds(new Set());
      loadRoutes();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const bulkPipelineAction = async (action, group_id) => {
    try {
      const res = await api.post("/firewall/pipelines/bulk-action", { ids: Array.from(selectedPipelineIds), action, group_id });
      toast.success(t("firewall.bulk_action_success", { count: res.data.updated }));
      setSelectedPipelineIds(new Set());
      loadPipelines();
      if (action === "delete") loadRoutes();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const exportLogs = async () => {
    try {
      const params = {};
      if (logsFilter !== "all") params.blocked = logsFilter === "blocked";
      const res = await api.get("/firewall/logs/export", { params, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `firewall_logs_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const logsTotalPages = Math.max(1, Math.ceil(logsTotal / logsLimit));

  return (
    <div data-testid="api-firewall-page">
      <div className="mb-6">
        <h1 className="flex items-center gap-2.5 text-4xl font-black tracking-tighter">
          <Network className="h-8 w-8 text-primary" /> {t("firewall.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("firewall.subtitle")}</p>
      </div>

      <Tabs defaultValue="routes">
        <TabsList data-testid="firewall-tabs">
          <TabsTrigger value="routes" data-testid="firewall-tab-routes">{t("firewall.tab_routes")}</TabsTrigger>
          <TabsTrigger value="pipelines" data-testid="firewall-tab-pipelines">{t("firewall.tab_pipelines")}</TabsTrigger>
          <TabsTrigger value="logs" data-testid="firewall-tab-logs">{t("firewall.tab_logs")}</TabsTrigger>
          <TabsTrigger value="settings" data-testid="firewall-tab-settings">{t("firewall.tab_settings")}</TabsTrigger>
        </TabsList>

        <TabsContent value="routes">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Select value={routeGroupFilter} onValueChange={setRouteGroupFilter}>
                <SelectTrigger className="w-56 rounded-sm" data-testid="route-group-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("firewall.all_groups")}</SelectItem>
                  <SelectItem value="none">{t("firewall.no_group")}</SelectItem>
                  {flattenGroupTree(routeGroups).map((g) => <SelectItem key={g.id} value={g.id}>{"— ".repeat(g.depth)}{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-1.5 rounded-sm" onClick={() => setRouteGroupsDialogOpen(true)} data-testid="manage-route-groups-page-btn">
                <Settings2 className="h-3.5 w-3.5" /> {t("firewall.manage_route_groups")}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-1.5 rounded-sm" onClick={() => document.getElementById("route-csv-input").click()} data-testid="import-routes-csv-btn">
                <Upload className="h-3.5 w-3.5" /> {t("firewall.import_csv")}
              </Button>
              <input
                id="route-csv-input" type="file" accept=".csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPendingCsvFile(f); setCsvMappingOpen(true); } e.target.value = ""; }}
                data-testid="import-routes-csv-input"
              />
              <Button className="gap-2 rounded-sm" onClick={() => { setEditingRoute(null); setRouteDialogOpen(true); }} data-testid="new-route-btn">
                <Plus className="h-4 w-4" /> {t("firewall.new_route")}
              </Button>
            </div>
          </div>
          <BulkActionsBar
            count={selectedRouteIds.size}
            groups={routeGroups}
            onEnable={() => bulkRouteAction("enable")}
            onDisable={() => bulkRouteAction("disable")}
            onMove={(group_id) => bulkRouteAction("move_group", group_id)}
            onDelete={() => bulkRouteAction("delete")}
            onClear={() => setSelectedRouteIds(new Set())}
            testIdPrefix="route"
          />
          <div className="border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("firewall.method")}</TableHead>
                  <TableHead>{t("firewall.path_pattern")}</TableHead>
                  <TableHead>{t("firewall.action_label")}</TableHead>
                  <TableHead>{t("firewall.target")}</TableHead>
                  <TableHead>{t("firewall.pipeline")}</TableHead>
                  <TableHead>{t("common.enabled")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routeTree.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground" data-testid="no-routes-text">
                      {t("firewall.no_routes")}
                    </TableCell>
                  </TableRow>
                )}
                <GroupTreeRows
                  tree={routeTree}
                  colSpan={9}
                  collapsedGroups={collapsedGroups}
                  toggleGroup={toggleGroup}
                  kindPrefix="route"
                  emptyLabel={t("firewall.no_routes")}
                  groupSelection={{ isSelected: routeGroupCheckState, onToggle: toggleRouteGroupSelected }}
                  renderItemRow={(r, indent) => (
                    <TableRow key={r.id} data-testid={`route-row-${r.id}`} className={highlightedRouteId === r.id ? "bg-orange-500/10 transition-colors duration-1000" : ""}>
                      <TableCell style={{ paddingLeft: indent }}>
                        <Checkbox checked={selectedRouteIds.has(r.id)} onCheckedChange={() => toggleRouteSelected(r.id)} data-testid={`route-select-${r.id}`} />
                      </TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell><Badge variant="outline" className="rounded-sm text-[10px]">{r.method}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.path_pattern}
                        {computeGroupPrefix(r.group_id, routeGroups) && (
                          <div className="mt-0.5 text-[10px] text-muted-foreground" data-testid={`route-effective-path-${r.id}`}>
                            {computeGroupPrefix(r.group_id, routeGroups)}{r.path_pattern}
                          </div>
                        )}
                      </TableCell>
                      <TableCell data-testid={`route-action-badge-${r.id}`}>
                        <Badge className={`whitespace-nowrap rounded-sm text-[10px] ${ACTION_BADGE_CLASS[r.action || "pipeline"]}`}>
                          {t(`firewall.action_${r.action || "pipeline"}`)}
                          {r.action === "block" ? ` (${r.block_status_code})` : ""}
                          {r.action === "respond" ? ` (${r.response_status_code})` : ""}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(r.action === "block" || r.action === "ignore") ? "—" : r.action === "function" ? (
                          <Badge variant="outline" className="rounded-sm text-[10px]" data-testid={`route-function-badge-${r.id}`}>
                            ƒ {functionName(r.function_id)}
                          </Badge>
                        ) : r.action === "respond" ? (
                          <span className="font-mono text-[10px]">{r.response_mime_type}</span>
                        ) : r.target_type === "route" ? (
                          <Badge
                            variant="outline"
                            className="cursor-pointer rounded-sm border-transparent bg-orange-100 text-[10px] font-normal text-orange-700 transition hover:bg-orange-200"
                            data-testid={`route-alias-badge-${r.id}`}
                            title={t("firewall.go_to_route")}
                            onClick={() => goToTargetRoute(r.target_route_id)}
                          >
                            {t("firewall.alias_label")}: {targetRouteGroupName(r) ? `${targetRouteGroupName(r)} / ` : ""}{targetLabel(r)}
                          </Badge>
                        ) : (
                          <>
                            <div>{targetLabel(r)}</div>
                            {targetPrefix(r) && (
                              <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/70" data-testid={`route-target-prefix-${r.id}`}>
                                {targetPrefix(r)}
                              </div>
                            )}
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.action === "pipeline" && (r.pipeline_ids || []).length > 0
                          ? (r.pipeline_ids || []).map((pid) => pipelineName(pid)).join(" → ")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Switch checked={r.enabled} onCheckedChange={(v) => toggleRouteEnabled(r, v)} data-testid={`route-enabled-toggle-${r.id}`} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="gap-1.5 rounded-sm" onClick={() => { setEditingRoute(r); setRouteDialogOpen(true); }} data-testid={`edit-route-${r.id}`}>
                            <Settings2 className="h-3.5 w-3.5" /> {t("common.edit")}
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5 rounded-sm" onClick={() => { setTestingRoute(r); setTestDialogOpen(true); }} data-testid={`test-route-${r.id}`}>
                            <Send className="h-3.5 w-3.5" /> {t("firewall.test_route")}
                          </Button>
                          <ConfirmDeleteButton testId={`delete-route-${r.id}`} onConfirm={() => deleteRoute(r.id)}>
                            <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button>
                          </ConfirmDeleteButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                />
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="pipelines">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Select value={pipelineGroupFilter} onValueChange={setPipelineGroupFilter}>
                <SelectTrigger className="w-56 rounded-sm" data-testid="pipeline-group-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("firewall.all_groups")}</SelectItem>
                  <SelectItem value="none">{t("firewall.no_group")}</SelectItem>
                  {flattenGroupTree(pipelineGroups).map((g) => <SelectItem key={g.id} value={g.id}>{"— ".repeat(g.depth)}{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-1.5 rounded-sm" onClick={() => setPipelineGroupsDialogOpen(true)} data-testid="manage-pipeline-groups-page-btn">
                <Settings2 className="h-3.5 w-3.5" /> {t("firewall.manage_pipeline_groups")}
              </Button>
            </div>
            <Button className="gap-2 rounded-sm" onClick={() => { setEditingPipeline(null); setPipelineDialogOpen(true); }} data-testid="new-pipeline-btn">
              <Plus className="h-4 w-4" /> {t("firewall.new_pipeline")}
            </Button>
          </div>
          <BulkActionsBar
            count={selectedPipelineIds.size}
            groups={pipelineGroups}
            onEnable={() => bulkPipelineAction("enable")}
            onDisable={() => bulkPipelineAction("disable")}
            onMove={(group_id) => bulkPipelineAction("move_group", group_id)}
            onDelete={() => bulkPipelineAction("delete")}
            onClear={() => setSelectedPipelineIds(new Set())}
            testIdPrefix="pipeline"
          />
          <div className="border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={allPipelinesSelected} onCheckedChange={toggleSelectAllPipelines} data-testid="pipeline-select-all-checkbox" />
                  </TableHead>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("firewall.checks_count")}</TableHead>
                  <TableHead>{t("common.enabled")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pipelineTree.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground" data-testid="no-pipelines-text">
                      {t("firewall.no_pipelines")}
                    </TableCell>
                  </TableRow>
                )}
                <GroupTreeRows
                  tree={pipelineTree}
                  colSpan={5}
                  collapsedGroups={collapsedGroups}
                  toggleGroup={toggleGroup}
                  kindPrefix="pipeline"
                  emptyLabel={t("firewall.no_pipelines")}
                  renderItemRow={(p, indent) => (
                    <TableRow key={p.id} data-testid={`pipeline-row-${p.id}`}>
                      <TableCell style={{ paddingLeft: indent }}>
                        <Checkbox checked={selectedPipelineIds.has(p.id)} onCheckedChange={() => togglePipelineSelected(p.id)} data-testid={`pipeline-select-${p.id}`} />
                      </TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant="outline" className="rounded-sm text-[10px]">{(p.checks || []).length}</Badge></TableCell>
                      <TableCell>
                        <Switch checked={p.enabled !== false} onCheckedChange={(v) => togglePipelineEnabled(p, v)} data-testid={`pipeline-enabled-toggle-${p.id}`} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="gap-1.5 rounded-sm" onClick={() => { setEditingPipeline(p); setPipelineDialogOpen(true); }} data-testid={`edit-pipeline-${p.id}`}>
                            <Settings2 className="h-3.5 w-3.5" /> {t("common.edit")}
                          </Button>
                          <ConfirmDeleteButton testId={`delete-pipeline-${p.id}`} onConfirm={() => deletePipeline(p.id)}>
                            <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button>
                          </ConfirmDeleteButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                />
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <div className="mb-4 flex items-center justify-between gap-2">
            <Select value={logsFilter} onValueChange={(v) => { setLogsFilter(v); setLogsPage(1); }}>
              <SelectTrigger className="w-56 rounded-sm" data-testid="firewall-logs-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("firewall.logs_all")}</SelectItem>
                <SelectItem value="blocked">{t("firewall.logs_blocked")}</SelectItem>
                <SelectItem value="allowed">{t("firewall.logs_allowed")}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-1.5 rounded-sm" onClick={exportLogs} data-testid="export-logs-csv-btn">
              <Download className="h-3.5 w-3.5" /> {t("firewall.export_csv")}
            </Button>
          </div>
          <div className="border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("audit.date")}</TableHead>
                  <TableHead>{t("firewall.method")}</TableHead>
                  <TableHead>{t("firewall.path")}</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>{t("firewall.route")}</TableHead>
                  <TableHead>{t("firewall.status")}</TableHead>
                  <TableHead>{t("firewall.function_col")}</TableHead>
                  <TableHead>{t("firewall.reason")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground" data-testid="no-firewall-logs-text">
                      {t("firewall.no_logs")}
                    </TableCell>
                  </TableRow>
                )}
                {logs.map((l) => (
                  <TableRow key={l.id} data-testid={`firewall-log-row-${l.id}`}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline" className="rounded-sm text-[10px]">{l.method}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{l.path}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.source_ip}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.route_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={l.blocked ? "destructive" : "secondary"} className="rounded-sm text-[10px]">
                        {l.blocked ? t("firewall.logs_blocked") : t("firewall.logs_allowed")} {l.status_code}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {l.function_name ? (
                        <Badge
                          variant="outline"
                          className={`cursor-pointer rounded-sm text-[10px] ${l.function_ok === false ? "border-destructive/40 text-destructive" : ""}`}
                          onClick={() => setLogDetail(l)}
                          data-testid={`firewall-log-function-${l.id}`}
                          title={t("firewall.function_view")}
                        >
                          ƒ {l.function_name} · {l.function_duration_ms}ms
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground" title={l.block_reason || ""}>{l.block_reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={logsPage} totalPages={logsTotalPages} onPageChange={setLogsPage}
            pageSize={logsLimit} onPageSizeChange={(n) => { setLogsLimit(n); setLogsPage(1); }}
          />
        </TabsContent>

        <TabsContent value="settings">
          <div className="max-w-md border border-border bg-card p-6" data-testid="firewall-settings-panel">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t("firewall.log_retention_days")}
            </label>
            {settings && (
              <Input
                type="number" min="0"
                value={settings.log_retention_days}
                onChange={(e) => setSettings((prev) => ({ ...prev, log_retention_days: e.target.value }))}
                data-testid="firewall-log-retention-input"
              />
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">{t("firewall.log_retention_help")}</p>
            <Button onClick={saveSettings} className="mt-4 rounded-sm" data-testid="save-firewall-settings-btn">
              {t("common.save")}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <RouteFormDialog
        open={routeDialogOpen}
        onOpenChange={(v) => { setRouteDialogOpen(v); if (!v && importReviewActive) finishImportReview(); }}
        editing={editingRoute} apps={apps} pipelines={pipelines} groups={routeGroups} routes={routes} functions={functions} onGroupsChanged={loadRouteGroups} onSaved={loadRoutes}
        reviewInfo={importReviewActive ? { index: importIndex, total: importQueue.length } : null}
        reviewRoutes={importQueue.slice(importIndex)}
        onReviewSaved={advanceImportReview}
        onReviewApplyAll={finishImportReview}
      />
      <PipelineFormDialog open={pipelineDialogOpen} onOpenChange={setPipelineDialogOpen} editing={editingPipeline} groups={pipelineGroups} onGroupsChanged={loadPipelineGroups} onSaved={loadPipelines} />
      <TestRouteDialog open={testDialogOpen} onOpenChange={setTestDialogOpen} route={testingRoute} groups={routeGroups} />
      <GroupsManagerDialog open={routeGroupsDialogOpen} onOpenChange={setRouteGroupsDialogOpen} kind="route" onChanged={() => { loadRouteGroups(); loadRoutes(); }} />
      <GroupsManagerDialog open={pipelineGroupsDialogOpen} onOpenChange={setPipelineGroupsDialogOpen} kind="pipeline" onChanged={() => { loadPipelineGroups(); loadPipelines(); }} />
      <CsvImportMappingDialog
        open={csvMappingOpen}
        onOpenChange={(v) => { setCsvMappingOpen(v); if (!v) setPendingCsvFile(null); }}
        file={pendingCsvFile}
        onConfirm={(mapping) => { setCsvMappingOpen(false); importRoutesCsv(pendingCsvFile, mapping); setPendingCsvFile(null); }}
      />

      <Dialog open={!!logDetail} onOpenChange={(v) => !v && setLogDetail(null)}>
        <DialogContent className="max-w-[42rem]" data-testid="log-function-detail-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              ƒ {logDetail?.function_name}
              <Badge variant={logDetail?.function_ok === false ? "destructive" : "secondary"} className="rounded-sm text-[10px]">
                {logDetail?.function_ok === false ? t("functions.error") : t("functions.success")} · {logDetail?.function_duration_ms}ms
              </Badge>
            </DialogTitle>
            <DialogDescription>{t("firewall.function_detail_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-[10px] uppercase text-muted-foreground">{t("functions.return_value")}</p>
              <pre className="max-h-48 overflow-auto rounded-sm bg-muted/50 p-2 text-[11px] whitespace-pre-wrap" data-testid="log-function-output">{logDetail?.function_output || "—"}</pre>
            </div>
            {logDetail?.function_logs && (
              <div>
                <p className="mb-1 text-[10px] uppercase text-muted-foreground">{t("functions.logs")}</p>
                <pre className="max-h-48 overflow-auto rounded-sm bg-muted/50 p-2 text-[11px] whitespace-pre-wrap" data-testid="log-function-logs">{logDetail.function_logs}</pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
