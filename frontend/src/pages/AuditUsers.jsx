import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollText } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ForbiddenState from "@/components/admin/ForbiddenState";
import Pagination from "@/components/admin/Pagination";

function formatAction(action) {
  return action.replace(/_/g, " ");
}

export default function AuditUsers() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [action, setAction] = useState("all");

  const load = () => {
    const params = { page, limit };
    if (action !== "all") params.action = action;
    api.get("/audit-logs", { params }).then((res) => {
      setLogs(res.data.logs);
      setTotal(res.data.total);
    });
  };

  useEffect(() => { if (user?.portal_role === "super_admin") load(); }, [user, page, limit, action]);
  useEffect(() => {
    if (user?.portal_role === "super_admin") {
      api.get("/audit-logs/actions").then((res) => setActions(res.data)).catch(() => setActions([]));
    }
  }, [user]);

  if (user?.portal_role !== "super_admin") return <ForbiddenState />;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div data-testid="audit-users-page">
      <div className="mb-6">
        <h1 className="flex items-center gap-2.5 text-4xl font-black tracking-tighter">
          <ScrollText className="h-8 w-8 text-primary" /> {t("audit.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("audit.subtitle")}</p>
      </div>

      <div className="mb-4">
        <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
          <SelectTrigger className="w-64 rounded-sm" data-testid="audit-filter-action">
            <SelectValue placeholder={t("audit.filter_action")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("audit.all_actions")}</SelectItem>
            {actions.map((a) => <SelectItem key={a} value={a}>{formatAction(a)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("audit.date")}</TableHead>
              <TableHead>{t("audit.actor")}</TableHead>
              <TableHead>{t("audit.action")}</TableHead>
              <TableHead>{t("audit.target_type")}</TableHead>
              <TableHead>{t("audit.details")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground" data-testid="no-audit-logs-text">
                  {t("audit.no_logs")}
                </TableCell>
              </TableRow>
            )}
            {logs.map((l) => (
              <TableRow key={l.id} data-testid={`audit-row-${l.id}`}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString()}
                </TableCell>
                <TableCell className="text-sm">{l.actor_name || l.actor_email || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-sm text-[10px] capitalize">{formatAction(l.action)}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.target_type}</TableCell>
                <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">{l.details}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={page} totalPages={totalPages} onPageChange={setPage}
        pageSize={limit} onPageSizeChange={(n) => { setLimit(n); setPage(1); }}
      />
    </div>
  );
}
