import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatError } from "@/lib/errors";
import { useAuth } from "@/contexts/AuthContext";
import { getAppPermission } from "@/lib/permissions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ForbiddenState from "@/components/admin/ForbiddenState";

export default function AppSettings() {
  const { t } = useTranslation();
  const { appId } = useParams();
  const { user } = useAuth();
  const [app, setApp] = useState(null);
  const [forbidden, setForbidden] = useState(false);
  const canEdit = getAppPermission(user, appId, "settings") === "edit";

  useEffect(() => {
    api.get(`/apps/${appId}`).then((res) => setApp(res.data)).catch(() => setForbidden(true));
  }, [appId]);

  const update = (field, value) => setApp((prev) => ({ ...prev, [field]: value }));

  const save = async () => {
    try {
      await api.put(`/apps/${appId}`, app);
      toast.success(t("common.success"));
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  if (forbidden) return <ForbiddenState />;
  if (!app) return null;

  const fields = [
    { key: "name", label: t("common.name") },
    { key: "description", label: t("common.description"), textarea: true },
    { key: "frontend_url", label: t("app_pages.frontend_url") },
    { key: "backend_url", label: t("app_pages.backend_url") },
  ];
  const dbFields = [
    { key: "mongo_url", label: t("app_pages.mongo_url") },
    { key: "db_name", label: t("app_pages.db_name") },
    { key: "users_collection", label: t("app_pages.users_collection") },
  ];

  return (
    <div className="max-w-2xl" data-testid="app-settings-page">
      <h1 className="mb-6 text-4xl font-black tracking-tighter">{t("app_pages.settings_title")}</h1>

      <div className="space-y-4 border border-border bg-card p-6">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">{f.label}</label>
            {f.textarea ? (
              <Textarea disabled={!canEdit} value={app[f.key] || ""} onChange={(e) => update(f.key, e.target.value)} data-testid={`settings-${f.key}`} />
            ) : (
              <Input disabled={!canEdit} value={app[f.key] || ""} onChange={(e) => update(f.key, e.target.value)} data-testid={`settings-${f.key}`} />
            )}
          </div>
        ))}
      </div>

      <h2 className="mt-6 mb-3 text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">{t("app_pages.connection_info")}</h2>
      <div className="space-y-4 border border-border bg-card p-6">
        {dbFields.map((f) => (
          <div key={f.key}>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">{f.label}</label>
            <Input disabled={!canEdit} value={app[f.key] || ""} onChange={(e) => update(f.key, e.target.value)} className="font-mono text-xs" data-testid={`settings-${f.key}`} />
          </div>
        ))}
      </div>

      {canEdit && (
        <Button onClick={save} className="mt-6 rounded-sm" data-testid="save-settings-btn">{t("common.save")}</Button>
      )}
    </div>
  );
}
