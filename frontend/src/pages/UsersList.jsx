import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Settings2, Plus, Trash2, RotateCcw, RefreshCw, KeyRound } from "lucide-react";
import api from "@/lib/api";
import { formatError } from "@/lib/errors";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ForbiddenState from "@/components/admin/ForbiddenState";
import ConfirmDeleteButton from "@/components/admin/ConfirmDeleteButton";

const SECTIONS = ["logs", "settings", "users", "db"];
const EMPTY_PERM = { logs: "none", settings: "none", users: "none", db: "none" };

export default function UsersList() {
  const { t } = useTranslation();
  const { user: me } = useAuth();

  const [users, setUsers] = useState([]);
  const [apps, setApps] = useState([]);
  const [groups, setGroups] = useState([]);
  const [editing, setEditing] = useState(null);
  const [permsDraft, setPermsDraft] = useState({});
  const [touchedApps, setTouchedApps] = useState(new Set());
  const [roleDraft, setRoleDraft] = useState("member");
  const [groupsDraft, setGroupsDraft] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("member");
  const [newGroupIds, setNewGroupIds] = useState([]);

  const load = () => {
    api.get("/users").then((res) => setUsers(res.data)).catch(() => {});
    api.get("/groups").then((res) => setGroups(res.data)).catch(() => {});
    api.get("/projects").then((res) => {
      const allApps = res.data.flatMap((p) => (p.apps || []).map((a) => ({ ...a, project_name: p.name })));
      setApps(allApps);
    });
  };

  useEffect(() => { if (me?.portal_role === "super_admin") load(); }, [me]);

  if (me?.portal_role !== "super_admin") return <ForbiddenState />;

  const openEdit = (u) => {
    setEditing(u);
    setRoleDraft(u.portal_role);
    setGroupsDraft(u.group_ids || []);
    const draft = {};
    const touched = new Set();
    apps.forEach((a) => {
      const existing = (u.app_permissions || []).find((p) => p.app_id === a.id);
      draft[a.id] = existing || { app_id: a.id, ...EMPTY_PERM };
      if (existing) touched.add(a.id);
    });
    setPermsDraft(draft);
    setTouchedApps(touched);
  };

  const setPerm = (appId, section, value) => {
    setPermsDraft((prev) => ({
      ...prev,
      [appId]: { ...(prev[appId] || { app_id: appId, ...EMPTY_PERM }), [section]: value },
    }));
    setTouchedApps((prev) => new Set(prev).add(appId));
  };

  const resetToInherit = (appId) => {
    setTouchedApps((prev) => { const next = new Set(prev); next.delete(appId); return next; });
    setPermsDraft((prev) => ({ ...prev, [appId]: { app_id: appId, ...EMPTY_PERM } }));
  };

  const toggleGroupInDraft = (groupId) => {
    setGroupsDraft((prev) => prev.includes(groupId) ? prev.filter((g) => g !== groupId) : [...prev, groupId]);
  };

  const savePermissions = async () => {
    try {
      const app_permissions = apps.filter((a) => touchedApps.has(a.id)).map((a) => permsDraft[a.id]);
      await api.put(`/users/${editing.user_id}`, {
        portal_role: roleDraft,
        app_permissions,
        group_ids: groupsDraft,
      });
      toast.success(t("common.success"));
      setEditing(null);
      load();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const createUser = async () => {
    if (!newName.trim() || !newEmail.trim() || newPassword.length < 8) return;
    try {
      await api.post("/users", {
        name: newName, email: newEmail, password: newPassword, portal_role: newRole, group_ids: newGroupIds,
      });
      toast.success(t("common.success"));
      setCreateOpen(false);
      setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("member"); setNewGroupIds([]);
      load();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const deleteUser = async (userId) => {
    try {
      await api.delete(`/users/${userId}`);
      toast.success(t("common.success"));
      load();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const reactivateUser = async (userId) => {
    try {
      await api.post(`/users/${userId}/reactivate`);
      toast.success(t("common.success"));
      load();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const deactivateUser = async (userId) => {
    try {
      await api.post(`/users/${userId}/deactivate`);
      toast.success(t("common.success"));
      load();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const reset2FA = async (userId) => {
    try {
      await api.post(`/users/${userId}/reset-2fa`);
      toast.success(t("common.success"));
      load();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const groupName = (id) => groups.find((g) => g.id === id)?.name || id;

  return (
    <div data-testid="users-page">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter">{t("users.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("users.subtitle")}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-sm" data-testid="new-user-btn">
              <Plus className="h-4 w-4" /> {t("users.new_user")}
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="new-user-dialog">
            <DialogHeader><DialogTitle>{t("users.new_user")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder={t("common.name")} value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="new-user-name-input" />
              <Input type="email" placeholder={t("users.email")} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} data-testid="new-user-email-input" />
              <Input type="password" placeholder={t("login.password")} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} data-testid="new-user-password-input" />
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger data-testid="new-user-role-select" className="rounded-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{t("users.member")}</SelectItem>
                  <SelectItem value="super_admin">{t("users.super_admin")}</SelectItem>
                </SelectContent>
              </Select>
              {groups.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("groups.title")}</p>
                  <div className="space-y-1.5">
                    {groups.map((g) => (
                      <label key={g.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={newGroupIds.includes(g.id)}
                          onCheckedChange={() => setNewGroupIds((prev) => prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id])}
                          data-testid={`new-user-group-${g.id}`}
                        />
                        {g.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={createUser} className="rounded-sm" data-testid="save-new-user-btn">{t("common.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("users.email")}</TableHead>
              <TableHead>{t("users.role")}</TableHead>
              <TableHead>{t("groups.title")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6" data-testid="no-users-text">{t("users.no_users")}</TableCell></TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.user_id} data-testid={`user-row-${u.user_id}`}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7 rounded-sm"><AvatarImage src={u.picture} /><AvatarFallback className="rounded-sm text-xs">{u.name?.[0]}</AvatarFallback></Avatar>
                    {u.name}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={u.portal_role === "super_admin" ? "default" : "secondary"} className="rounded-sm gap-1">
                      {u.portal_role === "super_admin" && <ShieldCheck className="h-3 w-3" />}
                      {u.portal_role === "super_admin" ? t("users.super_admin") : t("users.member")}
                    </Badge>
                    {u.is_active === false && (
                      <Badge variant="destructive" className="rounded-sm gap-1" data-testid={`deactivated-badge-${u.user_id}`}>
                        <ShieldOff className="h-3 w-3" /> {t("users.deactivated_badge")}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(u.group_ids || []).map((gid) => (
                      <Badge key={gid} variant="outline" className="rounded-sm text-[10px]">{groupName(gid)}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {u.is_active === false && (
                      <Button
                        size="sm" variant="outline" className="gap-1.5 rounded-sm"
                        onClick={() => reactivateUser(u.user_id)}
                        data-testid={`reactivate-user-${u.user_id}`}
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> {t("users.reactivate")}
                      </Button>
                    )}
                    {u.is_active !== false && u.user_id !== me?.user_id && (
                      <Button
                        size="sm" variant="outline" className="gap-1.5 rounded-sm"
                        onClick={() => deactivateUser(u.user_id)}
                        data-testid={`deactivate-user-${u.user_id}`}
                      >
                        <ShieldOff className="h-3.5 w-3.5" /> {t("users.deactivate")}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1.5 rounded-sm" onClick={() => openEdit(u)} data-testid={`edit-permissions-${u.user_id}`}>
                      <Settings2 className="h-3.5 w-3.5" /> {t("users.edit_permissions")}
                    </Button>
                    <Button
                      size="sm" variant="outline" className="gap-1.5 rounded-sm"
                      onClick={() => reset2FA(u.user_id)}
                      data-testid={`reset-2fa-${u.user_id}`}
                    >
                      <KeyRound className="h-3.5 w-3.5" /> {t("users.reset_2fa")}
                    </Button>
                    {u.user_id !== me.user_id && (
                      <ConfirmDeleteButton testId={`delete-user-${u.user_id}`} onConfirm={() => deleteUser(u.user_id)}>
                        <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button>
                      </ConfirmDeleteButton>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-[57.6rem]" data-testid="permissions-dialog">
          <DialogHeader><DialogTitle>{editing?.name} — {t("users.permissions")}</DialogTitle></DialogHeader>

          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("users.portal_role")}</label>
              <Select value={roleDraft} onValueChange={setRoleDraft}>
                <SelectTrigger data-testid="portal-role-select" className="rounded-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{t("users.member")}</SelectItem>
                  <SelectItem value="super_admin">{t("users.super_admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {groups.length > 0 && (
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("groups.title")}</label>
                <div className="flex flex-wrap gap-3">
                  {groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-1.5 text-sm">
                      <Checkbox
                        checked={groupsDraft.includes(g.id)}
                        onCheckedChange={() => toggleGroupInDraft(g.id)}
                        data-testid={`edit-user-group-${g.id}`}
                      />
                      {g.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="mb-2 text-xs text-muted-foreground">{t("users.override_note")}</p>
          <div className="max-h-80 overflow-y-auto border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  {SECTIONS.map((s) => (
                    <TableHead key={s} className="text-xs">{t(`permissions.section_${s}`)}</TableHead>
                  ))}
                  <TableHead className="text-xs"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm font-medium">
                      <div className="flex items-center gap-1.5">
                        {a.name}
                        {!touchedApps.has(a.id) && (
                          <Badge variant="outline" className="text-[9px] rounded-sm text-muted-foreground">{t("users.inherited_badge")}</Badge>
                        )}
                      </div>
                    </TableCell>
                    {SECTIONS.map((s) => (
                      <TableCell key={s}>
                        <Select
                          value={permsDraft[a.id]?.[s] || "none"}
                          onValueChange={(v) => setPerm(a.id, s, v)}
                        >
                          <SelectTrigger className="h-8 w-24 rounded-sm text-xs" data-testid={`perm-${a.id}-${s}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("permissions.none")}</SelectItem>
                            <SelectItem value="view">{t("permissions.view")}</SelectItem>
                            <SelectItem value="edit">{t("permissions.edit")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    ))}
                    <TableCell>
                      {touchedApps.has(a.id) && (
                        <button
                          onClick={() => resetToInherit(a.id)}
                          data-testid={`reset-inherit-${a.id}`}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary underline"
                        >
                          <RotateCcw className="h-3 w-3" /> {t("users.reset_to_inherit")}
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button onClick={savePermissions} className="rounded-sm" data-testid="save-permissions-btn">{t("users.save_permissions")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
