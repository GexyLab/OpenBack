import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { KeySquare, Plus, Trash2, Copy, Eye, EyeOff, RefreshCw, Wand2, ShieldCheck } from "lucide-react";
import api from "@/lib/api";
import { formatError } from "@/lib/errors";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import ConfirmDeleteButton from "@/components/admin/ConfirmDeleteButton";
import ForbiddenState from "@/components/admin/ForbiddenState";

const MASK = "••••••••••••";
const KEY_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const BITS_OPTIONS = [128, 256, 512];

function generateAlphanumericKey(bits) {
  const chars = Math.ceil(bits / Math.log2(KEY_ALPHABET.length));
  const buf = new Uint32Array(chars);
  (window.crypto || window.msCrypto).getRandomValues(buf);
  let out = "";
  for (let i = 0; i < chars; i++) out += KEY_ALPHABET[buf[i] % KEY_ALPHABET.length];
  return out;
}

export default function ApiKeysPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [keys, setKeys] = useState([]);
  const [revealed, setRevealed] = useState({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [bits, setBits] = useState(256);
  const [keyValue, setKeyValue] = useState("");
  const [hashed, setHashed] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [newKey, setNewKey] = useState(null);

  const loadKeys = () => api.get("/firewall/api-keys").then((res) => setKeys(res.data)).catch((e) => toast.error(formatError(e, t("common.error"))));

  useEffect(() => {
    if (user?.portal_role === "super_admin") loadKeys();
  }, [user]);

  if (user?.portal_role !== "super_admin") return <ForbiddenState />;

  const openCreateDialog = () => {
    setName("");
    setBits(256);
    setKeyValue(generateAlphanumericKey(256));
    setHashed(false);
    setExpiresAt("");
    setDialogOpen(true);
  };

  const regenerate = (nextBits) => {
    const b = nextBits || bits;
    setBits(b);
    setKeyValue(generateAlphanumericKey(b));
  };

  const createKey = async () => {
    if (!name.trim()) {
      toast.error(t("firewall.name_required"));
      return;
    }
    const value = keyValue || generateAlphanumericKey(bits);
    try {
      const res = await api.post("/firewall/api-keys", { name, key_value: value, hashed, expires_at: expiresAt || null });
      setDialogOpen(false);
      setNewKey({ plain_value: res.data.plain_value || value, hashed });
      loadKeys();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const deleteKey = async (id) => {
    try {
      await api.delete(`/firewall/api-keys/${id}`);
      toast.success(t("common.success"));
      loadKeys();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const rotateKey = async (id) => {
    try {
      const res = await api.post(`/firewall/api-keys/${id}/rotate`);
      toast.success(t("api_keys.rotate_success"));
      if (res.data?.hashed) {
        setNewKey({ plain_value: res.data.plain_value, hashed: true });
      } else {
        setRevealed((prev) => ({ ...prev, [id]: true }));
      }
      loadKeys();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const copyKey = async (value) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success(t("api_keys.copied"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const toggleReveal = (id) => setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));
  const isExpired = (k) => k.expires_at && new Date(k.expires_at) < new Date();

  return (
    <div data-testid="api-keys-page">
      <div className="mb-6">
        <h1 className="flex items-center gap-2.5 text-4xl font-black tracking-tighter">
          <KeySquare className="h-8 w-8 text-primary" /> {t("api_keys.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("api_keys.subtitle")}</p>
      </div>

      <div className="mb-4 flex justify-end">
        <Button className="gap-2 rounded-sm" onClick={openCreateDialog} data-testid="new-api-key-btn">
          <Plus className="h-4 w-4" /> {t("api_keys.new_key")}
        </Button>
      </div>

      <div className="border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("api_keys.key_value")}</TableHead>
              <TableHead>{t("api_keys.expiry_column")}</TableHead>
              <TableHead>{t("api_keys.usage_label")}</TableHead>
              <TableHead>{t("audit.date")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground" data-testid="no-api-keys-text">
                  {t("api_keys.no_keys")}
                </TableCell>
              </TableRow>
            )}
            {keys.map((k) => (
              <TableRow key={k.id} data-testid={`api-key-row-${k.id}`}>
                <TableCell className="font-medium">{k.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {k.hashed ? (
                      <Badge variant="outline" className="gap-1 rounded-sm text-[10px]" data-testid={`api-key-hashed-${k.id}`}>
                        <ShieldCheck className="h-3 w-3" /> {t("api_keys.hashed_badge")}
                      </Badge>
                    ) : (
                      <>
                        <span className="font-mono text-xs" data-testid={`api-key-value-${k.id}`}>
                          {revealed[k.id] ? k.key_value : MASK}
                        </span>
                        <Button size="icon" variant="ghost" onClick={() => toggleReveal(k.id)} data-testid={`toggle-reveal-api-key-${k.id}`}>
                          {revealed[k.id] ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => copyKey(k.key_value)} data-testid={`copy-api-key-${k.id}`}>
                          <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                      </>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild data-testid={`rotate-api-key-${k.id}`}>
                        <Button size="icon" variant="ghost">
                          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("api_keys.rotate_confirm_title")}</AlertDialogTitle>
                          <AlertDialogDescription>{t("api_keys.rotate_confirm_desc")}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid={`rotate-api-key-${k.id}-cancel`}>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => rotateKey(k.id)} data-testid={`rotate-api-key-${k.id}-confirm`}>
                            {t("api_keys.rotate")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs" data-testid={`api-key-expiry-${k.id}`}>
                  {k.expires_at ? (
                    isExpired(k) ? (
                      <Badge variant="destructive" className="rounded-sm text-[10px]">{t("api_keys.expiry_expired")}</Badge>
                    ) : (
                      <span className="text-muted-foreground">{new Date(k.expires_at).toLocaleDateString(i18n.language)}</span>
                    )
                  ) : (
                    <span className="text-muted-foreground">{t("api_keys.expiry_none")}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs" data-testid={`api-key-usage-${k.id}`}>
                  {(k.used_by || []).length > 0 ? (
                    <Badge variant="outline" className="rounded-sm text-[10px]" title={k.used_by.join(", ")}>
                      {t("api_keys.usage_count", { count: k.used_by.length })}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">{t("api_keys.usage_none")}</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(k.created_at).toLocaleString(i18n.language)}</TableCell>
                <TableCell className="text-right">
                  <ConfirmDeleteButton testId={`delete-api-key-${k.id}`} onConfirm={() => deleteKey(k.id)}>
                    <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button>
                  </ConfirmDeleteButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="api-key-dialog">
          <DialogHeader>
            <DialogTitle>{t("api_keys.new_key")}</DialogTitle>
            <DialogDescription>{t("api_keys.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder={t("common.name")} value={name} onChange={(e) => setName(e.target.value)} data-testid="api-key-name-input" />
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("api_keys.bits_label")}</label>
              <Select value={String(bits)} onValueChange={(v) => regenerate(Number(v))}>
                <SelectTrigger data-testid="api-key-bits-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BITS_OPTIONS.map((b) => (
                    <SelectItem key={b} value={String(b)} data-testid={`api-key-bits-option-${b}`}>{b} bit</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">{t("api_keys.bits_help")}</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <Input readOnly className="font-mono text-xs" value={keyValue} data-testid="api-key-generated-input" />
                <Button size="icon" variant="outline" className="shrink-0 rounded-sm" onClick={() => regenerate()} title={t("api_keys.generate")} data-testid="api-key-generate-btn">
                  <Wand2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="shrink-0 rounded-sm" onClick={() => copyKey(keyValue)} title={t("api_keys.copied")} data-testid="api-key-generated-copy-btn">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t("api_keys.generated_help")}</p>
            </div>
            <div className="flex items-start gap-2 rounded-sm border border-border p-3">
              <Checkbox id="hash-key" checked={hashed} onCheckedChange={(v) => setHashed(Boolean(v))} data-testid="api-key-hash-checkbox" />
              <div className="grid gap-0.5">
                <label htmlFor="hash-key" className="text-sm font-medium leading-none cursor-pointer">{t("api_keys.hash_label")}</label>
                <p className="text-xs text-muted-foreground">{t("api_keys.hash_help")}</p>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("api_keys.expiry_label")}</label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} data-testid="api-key-expiry-input" />
              <p className="mt-1 text-xs text-muted-foreground">{t("api_keys.expiry_help")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createKey} className="mt-2 rounded-sm" data-testid="save-api-key-btn">{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!newKey} onOpenChange={(o) => !o && setNewKey(null)}>
        <DialogContent data-testid="new-api-key-dialog">
          <DialogHeader>
            <DialogTitle>{t("api_keys.new_key_title")}</DialogTitle>
            <DialogDescription>{t("api_keys.new_key_desc")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-1.5">
            <Input readOnly className="font-mono text-xs" value={newKey?.plain_value || ""} data-testid="new-api-key-value" />
            <Button size="icon" variant="outline" className="shrink-0 rounded-sm" onClick={() => copyKey(newKey?.plain_value)} data-testid="new-api-key-copy-btn">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKey(null)} className="mt-2 rounded-sm" data-testid="new-api-key-done-btn">{t("api_keys.new_key_done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
