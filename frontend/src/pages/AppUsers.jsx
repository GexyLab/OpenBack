import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { getAppPermission } from "@/lib/permissions";
import CollectionBrowser from "@/components/admin/CollectionBrowser";
import ForbiddenState from "@/components/admin/ForbiddenState";

export default function AppUsers() {
  const { t } = useTranslation();
  const { appId } = useParams();
  const { user } = useAuth();
  const [usersCollection, setUsersCollection] = useState(null);
  const [forbidden, setForbidden] = useState(false);
  const canEdit = getAppPermission(user, appId, "users") === "edit";
  const canView = getAppPermission(user, appId, "users") !== "none";

  useEffect(() => {
    if (!canView) return;
    api.get(`/apps/${appId}`)
      .then((res) => setUsersCollection(res.data.users_collection || "users"))
      .catch(() => setForbidden(true));
  }, [appId, canView]);

  if (!canView || forbidden) return <ForbiddenState />;
  if (!usersCollection) return null;

  return (
    <div data-testid="app-users-page">
      <h1 className="mb-6 text-4xl font-black tracking-tighter">{t("app_pages.users_title")}</h1>
      <CollectionBrowser appId={appId} section="users" fixedCollection={usersCollection} canEdit={canEdit} />
    </div>
  );
}
