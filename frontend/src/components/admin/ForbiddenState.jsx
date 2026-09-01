import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";

export default function ForbiddenState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-border bg-card p-12 text-center" data-testid="forbidden-state">
      <ShieldAlert className="h-8 w-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{t("common.forbidden")}</p>
    </div>
  );
}
