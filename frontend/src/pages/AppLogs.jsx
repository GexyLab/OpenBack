import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { getAppPermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ForbiddenState from "@/components/admin/ForbiddenState";
import ConfirmDeleteButton from "@/components/admin/ConfirmDeleteButton";

export default function AppLogs() {
  const { t } = useTranslation();
  const { appId } = useParams();
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const canEdit = getAppPermission(user, appId, "logs") === "edit";
  const canView = getAppPermission(user, appId, "logs") !== "none";

  const load = () => api.get(`/apps/${appId}/logs`).then((res) => setLogs(res.data));
  useEffect(() => { if (canView) load(); }, [appId, canView]);

  const clearLogs = async () => {
    await api.delete(`/apps/${appId}/logs`);
    toast.success(t("common.success"));
    load();
  };

  const levelVariant = (l) => (l === "error" ? "destructive" : l === "warning" ? "secondary" : "outline");

  if (!canView) return <ForbiddenState />;

  return (
    <div data-testid="app-logs-page">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-4xl font-black tracking-tighter">{t("app_pages.logs_title")}</h1>
        {canEdit && (
          <ConfirmDeleteButton testId="clear-logs-btn" onConfirm={clearLogs}>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-sm">
              <Trash2 className="h-3.5 w-3.5" /> {t("app_pages.clear_logs")}
            </Button>
          </ConfirmDeleteButton>
        )}
      </div>
      {!logs.length ? (
        <p className="text-sm text-muted-foreground" data-testid="no-logs-text">{t("app_pages.no_logs")}</p>
      ) : (
        <div className="border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("app_pages.level")}</TableHead>
                <TableHead>{t("app_pages.message")}</TableHead>
                <TableHead>{t("app_pages.source")}</TableHead>
                <TableHead>{t("common.created_at")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id} data-testid={`log-row-${l.id}`}>
                  <TableCell><Badge variant={levelVariant(l.level)} className="rounded-sm text-[10px] uppercase">{l.level}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{l.message}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.source}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
