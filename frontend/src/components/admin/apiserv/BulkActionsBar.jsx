import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, FolderInput, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { flattenGroupTree } from "@/lib/groupTree";

export default function BulkActionsBar({ count, groups, onEnable, onDisable, onMove, onDelete, onClear, testIdPrefix }) {
  const { t } = useTranslation();
  const [moveGroupId, setMoveGroupId] = useState("");

  useEffect(() => {
    if (count === 0) setMoveGroupId("");
  }, [count]);

  if (count === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 border border-primary/30 bg-primary/5 px-3 py-2" data-testid={`${testIdPrefix}-bulk-bar`}>
      <span className="text-sm font-bold" data-testid={`${testIdPrefix}-bulk-count`}>{t("firewall.bulk_selected_count", { count })}</span>
      <Button size="sm" variant="outline" className="gap-1.5 rounded-sm" onClick={onEnable} data-testid={`${testIdPrefix}-bulk-enable-btn`}>
        <CheckCircle2 className="h-3.5 w-3.5" /> {t("firewall.bulk_enable")}
      </Button>
      <Button size="sm" variant="outline" className="gap-1.5 rounded-sm" onClick={onDisable} data-testid={`${testIdPrefix}-bulk-disable-btn`}>
        <XCircle className="h-3.5 w-3.5" /> {t("firewall.bulk_disable")}
      </Button>
      <div className="flex items-center gap-1.5">
        <Select value={moveGroupId} onValueChange={setMoveGroupId}>
          <SelectTrigger className="h-8 w-52 rounded-sm text-xs" data-testid={`${testIdPrefix}-bulk-move-select`}>
            <SelectValue placeholder={t("firewall.bulk_move_placeholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("firewall.no_group")}</SelectItem>
            {flattenGroupTree(groups).map((g) => <SelectItem key={g.id} value={g.id}>{"— ".repeat(g.depth)}{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          size="sm" variant="outline" className="gap-1.5 rounded-sm" disabled={!moveGroupId}
          onClick={() => { onMove(moveGroupId === "none" ? null : moveGroupId); setMoveGroupId(""); }}
          data-testid={`${testIdPrefix}-bulk-move-btn`}
        >
          <FolderInput className="h-3.5 w-3.5" /> {t("firewall.bulk_move")}
        </Button>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5 rounded-sm border-destructive/40 text-destructive hover:bg-destructive/10" data-testid={`${testIdPrefix}-bulk-delete-btn`}>
            <Trash2 className="h-3.5 w-3.5" /> {t("firewall.bulk_delete")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("firewall.bulk_delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("firewall.bulk_delete_confirm_desc", { count })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`${testIdPrefix}-bulk-delete-cancel`}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} data-testid={`${testIdPrefix}-bulk-delete-confirm`}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Button size="sm" variant="ghost" className="ml-auto gap-1.5 rounded-sm" onClick={onClear} data-testid={`${testIdPrefix}-bulk-clear-btn`}>
        <X className="h-3.5 w-3.5" /> {t("firewall.bulk_clear")}
      </Button>
    </div>
  );
}
