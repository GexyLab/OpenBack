import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import api from "@/lib/api";
import { formatError } from "@/lib/errors";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import ForbiddenState from "@/components/admin/ForbiddenState";

export default function AuthSettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (user?.portal_role === "super_admin") {
      api.get("/auth-settings").then((res) => setSettings(res.data));
    }
  }, [user]);

  if (user?.portal_role !== "super_admin") return <ForbiddenState />;
  if (!settings) return null;

  const update = (field, value) => setSettings((prev) => ({ ...prev, [field]: value }));

  const save = async () => {
    try {
      const res = await api.put("/auth-settings", {
        max_login_attempts: Number(settings.max_login_attempts),
        lockout_minutes: Number(settings.lockout_minutes),
        security_notification_email: settings.security_notification_email,
        access_token_minutes: Number(settings.access_token_minutes),
        refresh_token_days: Number(settings.refresh_token_days),
        two_fa_enabled: settings.two_fa_enabled,
      });
      setSettings(res.data);
      toast.success(t("common.success"));
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const fields = [
    { key: "max_login_attempts", type: "number", label: t("auth_settings.max_attempts"), help: t("auth_settings.max_attempts_help") },
    { key: "lockout_minutes", type: "number", label: t("auth_settings.lockout_minutes"), help: t("auth_settings.lockout_minutes_help") },
    { key: "security_notification_email", type: "email", label: t("auth_settings.notification_email"), help: t("auth_settings.notification_email_help") },
    { key: "access_token_minutes", type: "number", label: t("auth_settings.access_token_minutes"), help: t("auth_settings.access_token_minutes_help") },
    { key: "refresh_token_days", type: "number", label: t("auth_settings.refresh_token_days"), help: t("auth_settings.refresh_token_days_help") },
  ];

  return (
    <div className="max-w-xl" data-testid="auth-settings-page">
      <h1 className="mb-1 flex items-center gap-2.5 text-4xl font-black tracking-tighter">
        <KeyRound className="h-8 w-8 text-primary" /> {t("auth_settings.title")}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("auth_settings.subtitle")}</p>

      <div className="mb-5 flex items-center justify-between border border-border bg-card p-6">
        <div>
          <p className="text-sm font-bold">{t("auth_settings.two_fa_enabled")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("auth_settings.two_fa_enabled_help")}</p>
        </div>
        <Switch
          checked={settings.two_fa_enabled}
          onCheckedChange={(v) => update("two_fa_enabled", v)}
          data-testid="auth-settings-two-fa-toggle"
        />
      </div>

      <div className="space-y-5 border border-border bg-card p-6">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">{f.label}</label>
            <Input
              type={f.type}
              value={settings[f.key] ?? ""}
              onChange={(e) => update(f.key, e.target.value)}
              data-testid={`auth-settings-${f.key}`}
            />
            <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>
          </div>
        ))}
      </div>

      <Button onClick={save} className="mt-6 rounded-sm" data-testid="save-auth-settings-btn">{t("common.save")}</Button>
    </div>
  );
}
