import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";
import { Cpu, Plus, Trash2, Settings2, Play, Loader2, Eye, EyeOff, Code2, History, RotateCcw } from "lucide-react";
import api from "@/lib/api";
import { formatError } from "@/lib/errors";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import ConfirmDeleteButton from "@/components/admin/ConfirmDeleteButton";
import ForbiddenState from "@/components/admin/ForbiddenState";

const TEMPLATES = {
  python: `def handler(event):
    # event = {method, path, headers, query, body, ip}
    return {
        "status_code": 200,
        "headers": {},
        "body": {"message": "Hello from Python", "path": event.get("path")},
    }
`,
  javascript: `function handler(event) {
  // event = {method, path, headers, query, body, ip}
  return {
    status_code: 200,
    headers: {},
    body: { message: "Hello from JavaScript", path: event.path },
  };
}
`,
};

const EMPTY = { name: "", description: "", runtime: "python", code: TEMPLATES.python, variables: [], timeout_ms: 5000, enabled: true };
const DEFAULT_EVENT = `{
  "method": "GET",
  "path": "/hello",
  "headers": {},
  "query": {},
  "body": null
}`;

const SNIPPETS = {
  python: [
    {
      key: "auth",
      code: `def handler(event):
    # API key attesa in event["vars"]["API_KEY"], client invia header X-API-Key
    expected = (event.get("vars") or {}).get("API_KEY")
    provided = (event.get("headers") or {}).get("x-api-key")
    if not expected or provided != expected:
        return {"status_code": 401, "body": {"error": "Unauthorized"}}
    return {"status_code": 200, "body": {"ok": True}}
`,
    },
    {
      key: "transform",
      code: `def handler(event):
    # Trasforma il body JSON in ingresso (chiavi in maiuscolo)
    body = event.get("body") or {}
    if isinstance(body, dict):
        body = {str(k).upper(): v for k, v in body.items()}
    return {"status_code": 200, "headers": {"Content-Type": "application/json"}, "body": body}
`,
    },
    {
      key: "ratelimit",
      code: `def handler(event):
    # Rate-limit custom: soglia da variabile, contatore inviato dal client
    limit = int((event.get("vars") or {}).get("LIMIT", "100"))
    count = int((event.get("headers") or {}).get("x-request-count", "0"))
    if count > limit:
        return {"status_code": 429, "body": {"error": "Rate limit exceeded", "limit": limit}}
    return {"status_code": 200, "body": {"remaining": limit - count}}
`,
    },
  ],
  javascript: [
    {
      key: "auth",
      code: `function handler(event) {
  // API key attesa in event.vars.API_KEY, client invia header X-API-Key
  const expected = (event.vars || {}).API_KEY;
  const provided = (event.headers || {})["x-api-key"];
  if (!expected || provided !== expected) {
    return { status_code: 401, body: { error: "Unauthorized" } };
  }
  return { status_code: 200, body: { ok: true } };
}
`,
    },
    {
      key: "transform",
      code: `function handler(event) {
  // Trasforma il body JSON in ingresso (chiavi in maiuscolo)
  let body = event.body || {};
  if (body && typeof body === "object" && !Array.isArray(body)) {
    body = Object.fromEntries(Object.entries(body).map(([k, v]) => [String(k).toUpperCase(), v]));
  }
  return { status_code: 200, headers: { "Content-Type": "application/json" }, body };
}
`,
    },
    {
      key: "ratelimit",
      code: `function handler(event) {
  // Rate-limit custom: soglia da variabile, contatore inviato dal client
  const limit = parseInt((event.vars || {}).LIMIT || "100", 10);
  const count = parseInt((event.headers || {})["x-request-count"] || "0", 10);
  if (count > limit) {
    return { status_code: 429, body: { error: "Rate limit exceeded", limit } };
  }
  return { status_code: 200, body: { remaining: limit - count } };
}
`,
    },
  ],
};

export default function FunctionsPage() {
  const { t, i18n } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();
  const [functions, setFunctions] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [testEvent, setTestEvent] = useState(DEFAULT_EVENT);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [revealedVars, setRevealedVars] = useState({});
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);

  const load = () => api.get("/firewall/functions").then((res) => setFunctions(res.data)).catch((e) => toast.error(formatError(e, t("common.error"))));
  const loadMetrics = () => api.get("/firewall/functions/metrics").then((res) => setMetrics(res.data)).catch(() => setMetrics({}));

  useEffect(() => {
    if (user?.portal_role === "super_admin") { load(); loadMetrics(); }
  }, [user]);

  if (user?.portal_role !== "super_admin") return <ForbiddenState />;

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setTestEvent(DEFAULT_EVENT);
    setTestResult(null);
    setRevealedVars({});
    setDialogOpen(true);
  };

  const openEdit = (fn) => {
    setEditing(fn);
    setForm({ name: fn.name, description: fn.description || "", runtime: fn.runtime, code: fn.code || "", variables: fn.variables || [], timeout_ms: fn.timeout_ms || 5000, enabled: fn.enabled !== false });
    setTestEvent(DEFAULT_EVENT);
    setTestResult(null);
    setRevealedVars({});
    setDialogOpen(true);
  };

  const addVar = () => update({ variables: [...(form.variables || []), { key: "", value: "" }] });
  const updateVar = (i, patch) => update({ variables: form.variables.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) });
  const removeVar = (i) => update({ variables: form.variables.filter((_, idx) => idx !== i) });

  const applySnippet = (key) => {
    const snip = (SNIPPETS[form.runtime] || []).find((s) => s.key === key);
    if (snip) update({ code: snip.code });
  };

  const openVersions = async () => {
    if (!editing) return;
    setSelectedVersion(null);
    setVersionsOpen(true);
    try {
      const res = await api.get(`/firewall/functions/${editing.id}/versions`);
      setVersions(res.data);
      if (res.data.length) setSelectedVersion(res.data[0]);
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const restoreVersion = async (versionId) => {
    try {
      const res = await api.post(`/firewall/functions/${editing.id}/versions/${versionId}/restore`);
      update({ code: res.data.code, runtime: res.data.runtime, timeout_ms: res.data.timeout_ms });
      toast.success(t("functions.restore_success"));
      setVersionsOpen(false);
      load();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const changeRuntime = (runtime) => {
    const isTemplate = form.code === TEMPLATES.python || form.code === TEMPLATES.javascript || !form.code?.trim();
    update({ runtime, code: isTemplate ? TEMPLATES[runtime] : form.code });
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(t("firewall.name_required"));
      return;
    }
    const payload = { ...form, timeout_ms: Number(form.timeout_ms) || 5000, variables: (form.variables || []).filter((v) => v.key?.trim()) };
    try {
      if (editing) await api.put(`/firewall/functions/${editing.id}`, payload);
      else await api.post("/firewall/functions", payload);
      toast.success(t("common.success"));
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/firewall/functions/${id}`);
      toast.success(t("common.success"));
      load();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const runTest = async () => {
    let event;
    try {
      event = testEvent.trim() ? JSON.parse(testEvent) : {};
    } catch {
      toast.error(t("functions.invalid_event_json"));
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post("/firewall/functions/test", { runtime: form.runtime, code: form.code, timeout_ms: Number(form.timeout_ms) || 5000, variables: (form.variables || []).filter((v) => v.key?.trim()), event });
      setTestResult(res.data);
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div data-testid="functions-page">
      <div className="mb-6">
        <h1 className="flex items-center gap-2.5 text-4xl font-black tracking-tighter">
          <Cpu className="h-8 w-8 text-primary" /> {t("functions.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("functions.subtitle")}</p>
      </div>

      <div className="mb-4 flex justify-end">
        <Button className="gap-2 rounded-sm" onClick={openNew} data-testid="new-function-btn">
          <Plus className="h-4 w-4" /> {t("functions.new_function")}
        </Button>
      </div>

      <div className="border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("functions.runtime")}</TableHead>
              <TableHead>{t("functions.timeout")}</TableHead>
              <TableHead>{t("functions.metrics")}</TableHead>
              <TableHead>{t("common.enabled")}</TableHead>
              <TableHead>{t("audit.date")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {functions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground" data-testid="no-functions-text">
                  {t("functions.no_functions")}
                </TableCell>
              </TableRow>
            )}
            {functions.map((fn) => (
              <TableRow key={fn.id} data-testid={`function-row-${fn.id}`}>
                <TableCell className="font-medium">
                  {fn.name}
                  {fn.description && <div className="text-xs text-muted-foreground">{fn.description}</div>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-sm text-[10px]">{fn.runtime === "javascript" ? "JavaScript" : "Python"}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{fn.timeout_ms} ms</TableCell>
                <TableCell className="text-xs" data-testid={`function-metrics-${fn.id}`}>
                  {metrics[fn.id] ? (
                    <span className="whitespace-nowrap text-muted-foreground">
                      <span className="font-semibold text-foreground">{metrics[fn.id].count}</span> {t("functions.invocations")} · {t("functions.avg")} <span className="font-semibold text-foreground">{metrics[fn.id].avg_ms}</span> ms
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t("functions.no_metrics")}</span>
                  )}
                </TableCell>
                <TableCell><Badge variant={fn.enabled ? "secondary" : "outline"} className="rounded-sm text-[10px]">{fn.enabled ? t("common.enabled") : t("common.disabled")}</Badge></TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(fn.updated_at || fn.created_at).toLocaleString(i18n.language)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 rounded-sm" onClick={() => openEdit(fn)} data-testid={`edit-function-${fn.id}`}>
                      <Settings2 className="h-3.5 w-3.5" /> {t("common.edit")}
                    </Button>
                    <ConfirmDeleteButton testId={`delete-function-${fn.id}`} onConfirm={() => remove(fn.id)}>
                      <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button>
                    </ConfirmDeleteButton>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-[62rem] overflow-y-auto" data-testid="function-dialog">
          <DialogHeader>
            <DialogTitle>{editing ? t("functions.edit_function") : t("functions.new_function")}</DialogTitle>
            <DialogDescription>{t("functions.form_help")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder={t("common.name")} value={form.name} onChange={(e) => update({ name: e.target.value })} data-testid="function-name-input" />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.runtime} onValueChange={changeRuntime}>
                <SelectTrigger className="rounded-sm" data-testid="function-runtime-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="python" data-testid="function-runtime-python">Python</SelectItem>
                  <SelectItem value="javascript" data-testid="function-runtime-javascript">JavaScript</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" min="100" max="30000" step="100" value={form.timeout_ms} onChange={(e) => update({ timeout_ms: e.target.value })} title={t("functions.timeout")} data-testid="function-timeout-input" />
            </div>
          </div>
          <Input placeholder={t("common.description")} value={form.description} onChange={(e) => update({ description: e.target.value })} data-testid="function-description-input" />

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("functions.code")}</span>
            <div className="flex items-center gap-2">
              {editing && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-sm text-xs" onClick={openVersions} data-testid="function-history-btn">
                  <History className="h-3.5 w-3.5" /> {t("functions.history")}
                </Button>
              )}
              <Select value="" onValueChange={applySnippet}>
              <SelectTrigger className="h-8 w-56 rounded-sm text-xs" data-testid="function-snippet-select">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Code2 className="h-3.5 w-3.5" /> {t("functions.snippets")}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auth" data-testid="function-snippet-auth">{t("functions.snippet_auth")}</SelectItem>
                <SelectItem value="transform" data-testid="function-snippet-transform">{t("functions.snippet_transform")}</SelectItem>
                <SelectItem value="ratelimit" data-testid="function-snippet-ratelimit">{t("functions.snippet_ratelimit")}</SelectItem>
              </SelectContent>
            </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-sm border border-border" data-testid="function-code-editor">
            <Editor
              height="320px"
              language={form.runtime === "javascript" ? "javascript" : "python"}
              theme={resolvedTheme === "light" ? "light" : "vs-dark"}
              value={form.code}
              onChange={(v) => update({ code: v ?? "" })}
              options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, tabSize: 2, automaticLayout: true }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("functions.handler_hint")}</p>

          <div className="rounded-sm border border-border p-3" data-testid="function-variables-section">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("functions.variables")}</p>
                <p className="text-xs text-muted-foreground">{t("functions.variables_help")}</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-sm" onClick={addVar} data-testid="add-variable-btn">
                <Plus className="h-3.5 w-3.5" /> {t("common.add")}
              </Button>
            </div>
            <div className="space-y-2">
              {(form.variables || []).length === 0 && <p className="text-xs text-muted-foreground">{t("functions.no_variables")}</p>}
              {(form.variables || []).map((v, i) => (
                <div key={i} className="flex items-center gap-2" data-testid={`variable-row-${i}`}>
                  <Input className="h-8 flex-1 font-mono text-xs" placeholder="KEY" value={v.key} onChange={(e) => updateVar(i, { key: e.target.value })} data-testid={`variable-key-${i}`} />
                  <Input
                    className="h-8 flex-1 font-mono text-xs"
                    type={revealedVars[i] ? "text" : "password"}
                    placeholder={t("common.value")}
                    value={v.value}
                    onChange={(e) => updateVar(i, { value: e.target.value })}
                    data-testid={`variable-value-${i}`}
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRevealedVars((p) => ({ ...p, [i]: !p[i] }))} data-testid={`variable-reveal-${i}`}>
                    {revealedVars[i] ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeVar(i)} data-testid={`variable-remove-${i}`}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-sm border border-border p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("functions.test_section")}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("functions.test_event")}</label>
                <Textarea className="h-40 font-mono text-xs" value={testEvent} onChange={(e) => setTestEvent(e.target.value)} data-testid="function-test-event-input" />
                <Button size="sm" className="mt-2 gap-1.5 rounded-sm" onClick={runTest} disabled={testing} data-testid="function-run-test-btn">
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} {t("functions.run_test")}
                </Button>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("functions.test_result")}</label>
                {testResult ? (
                  <div className="space-y-1.5" data-testid="function-test-result">
                    <div className="flex items-center gap-2">
                      <Badge variant={testResult.ok ? "secondary" : "destructive"} className="rounded-sm text-[10px]" data-testid="function-test-status">
                        {testResult.ok ? t("functions.success") : t("functions.error")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{testResult.duration_ms} ms</span>
                    </div>
                    {testResult.error && <pre className="max-h-24 overflow-auto rounded-sm bg-destructive/10 p-2 text-[11px] text-destructive whitespace-pre-wrap">{testResult.error}</pre>}
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground">{t("functions.return_value")}</span>
                      <pre className="max-h-32 overflow-auto rounded-sm bg-muted/50 p-2 text-[11px] whitespace-pre-wrap">{JSON.stringify(testResult.result, null, 2)}</pre>
                    </div>
                    {testResult.logs && (
                      <div>
                        <span className="text-[10px] uppercase text-muted-foreground">{t("functions.logs")}</span>
                        <pre className="max-h-24 overflow-auto rounded-sm bg-muted/50 p-2 text-[11px] whitespace-pre-wrap">{testResult.logs}</pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("functions.test_hint")}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-sm border border-border p-2.5">
            <span className="text-xs font-medium">{t("common.enabled")}</span>
            <Switch checked={!!form.enabled} onCheckedChange={(v) => update({ enabled: v })} data-testid="function-enabled-switch" />
          </div>

          <DialogFooter>
            <Button onClick={save} className="rounded-sm" data-testid="save-function-btn">{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
        <DialogContent className="max-h-[90vh] max-w-[60rem] overflow-hidden" data-testid="function-versions-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" /> {t("functions.history")}</DialogTitle>
            <DialogDescription>{t("functions.history_help")}</DialogDescription>
          </DialogHeader>
          {versions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground" data-testid="no-versions-text">{t("functions.no_versions")}</p>
          ) : (
            <div className="grid grid-cols-[16rem_1fr] gap-3">
              <div className="max-h-[55vh] space-y-1 overflow-y-auto border-r border-border pr-2">
                {versions.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVersion(v)}
                    className={`w-full rounded-sm border px-2.5 py-2 text-left text-xs transition-colors ${selectedVersion?.id === v.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}
                    data-testid={`version-item-${i}`}
                  >
                    <div className="font-medium">{new Date(v.created_at).toLocaleString(i18n.language)}</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Badge variant="outline" className="rounded-sm text-[9px]">{v.runtime === "javascript" ? "JavaScript" : "Python"}</Badge>
                      {i === 0 && <span className="text-[10px] text-muted-foreground">{t("functions.most_recent")}</span>}
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex min-w-0 flex-col">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("functions.version_preview")}</span>
                  {selectedVersion && (
                    <Button size="sm" className="h-8 gap-1.5 rounded-sm" onClick={() => restoreVersion(selectedVersion.id)} data-testid="restore-version-btn">
                      <RotateCcw className="h-3.5 w-3.5" /> {t("functions.restore")}
                    </Button>
                  )}
                </div>
                <pre className="max-h-[50vh] flex-1 overflow-auto rounded-sm bg-muted/50 p-3 text-[11px] whitespace-pre-wrap" data-testid="version-preview-code">{selectedVersion?.code || ""}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
