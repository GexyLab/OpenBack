import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
import api from "@/lib/api";
import { computeGroupPrefix } from "@/lib/groupTree";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export default function TestRouteDialog({ open, onOpenChange, route, groups }) {
  const { t } = useTranslation();
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("");
  const [query, setQuery] = useState("");
  const [body, setBody] = useState("");
  const [headers, setHeaders] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open && route) {
      setMethod(route.method && route.method !== "*" ? route.method : "GET");
      const fullPattern = (computeGroupPrefix(route.group_id, groups || []) || "") + route.path_pattern;
      setPath(fullPattern.endsWith("/*") ? fullPattern.slice(0, -1) : fullPattern);
      setQuery("");
      setBody("");
      setHeaders("");
      setResult(null);
    }
  }, [open, route, groups]);

  const send = async () => {
    setLoading(true);
    setResult(null);
    let parsedHeaders = {};
    headers.split("\n").forEach((line) => {
      const idx = line.indexOf(":");
      if (idx > 0) parsedHeaders[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    });
    let parsedBody;
    if (body.trim() && ["POST", "PUT", "PATCH"].includes(method)) {
      try { parsedBody = JSON.parse(body); } catch { parsedBody = body; }
    }
    const url = `/apiserv${path.startsWith("/") ? path : "/" + path}${query.trim() ? `?${query.trim()}` : ""}`;
    try {
      const res = await api.request({
        method, url, headers: parsedHeaders, data: parsedBody, validateStatus: () => true,
      });
      setResult({ status: res.status, headers: res.headers, data: res.data });
    } catch (e) {
      setResult({ status: "error", data: e.message });
    } finally {
      setLoading(false);
    }
  };

  const statusVariant = (status) => {
    if (status === "error") return "destructive";
    if (status >= 200 && status < 300) return "secondary";
    if (status >= 400) return "destructive";
    return "outline";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[43.2rem] overflow-y-auto" data-testid="test-route-dialog">
        <DialogHeader><DialogTitle>{t("firewall.test_route_title")} {route ? `— ${route.name}` : ""}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="rounded-sm" data-testid="test-route-method-select"><SelectValue /></SelectTrigger>
              <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Input className="col-span-2" placeholder="/percorso" value={path} onChange={(e) => setPath(e.target.value)} data-testid="test-route-path-input" />
          </div>
          <Input placeholder={t("firewall.test_route_query")} value={query} onChange={(e) => setQuery(e.target.value)} data-testid="test-route-query-input" />
          <Textarea
            placeholder={t("firewall.test_route_headers")} value={headers} onChange={(e) => setHeaders(e.target.value)}
            className="font-mono text-xs" rows={2} data-testid="test-route-headers-input"
          />
          {["POST", "PUT", "PATCH"].includes(method) && (
            <Textarea
              placeholder='{"key":"value"}' value={body} onChange={(e) => setBody(e.target.value)}
              className="font-mono text-xs" rows={3} data-testid="test-route-body-input"
            />
          )}
          <Button onClick={send} disabled={loading} className="gap-2 rounded-sm" data-testid="test-route-send-btn">
            <Send className="h-3.5 w-3.5" /> {t("firewall.test_route_send")}
          </Button>

          {result && (
            <div className="border border-border bg-background p-3" data-testid="test-route-result">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-muted-foreground">{t("firewall.test_route_result")}</span>
                <Badge variant={statusVariant(result.status)} className="rounded-sm" data-testid="test-route-result-status">
                  {result.status}
                </Badge>
              </div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all text-xs" data-testid="test-route-result-body">
                {typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
