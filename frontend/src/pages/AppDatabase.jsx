import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getAppPermission } from "@/lib/permissions";
import CollectionBrowser from "@/components/admin/CollectionBrowser";
import ForbiddenState from "@/components/admin/ForbiddenState";

export default function AppDatabase() {
  const { t } = useTranslation();
  const { appId } = useParams();
  const { user } = useAuth();
  const canEdit = getAppPermission(user, appId, "db") === "edit";
  const canView = getAppPermission(user, appId, "db") !== "none";

  if (!canView) return <ForbiddenState />;

  return (
    <div data-testid="app-database-page">
      <h1 className="mb-6 text-4xl font-black tracking-tighter">{t("app_pages.database_title")}</h1>
      <CollectionBrowser appId={appId} section="db" canEdit={canEdit} />
    </div>
  );
}
