import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

function parseCsvHeaderLine(line) {
  const cols = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cols.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current.trim());
  return cols.filter(Boolean);
}

const FIELDS = [
  { key: "name", labelKey: "firewall.map_field_name", required: true, defaultCol: "Category" },
  { key: "method", labelKey: "firewall.map_field_method", required: false, defaultCol: "Method" },
  { key: "path_pattern", labelKey: "firewall.map_field_path", required: true, defaultCol: "Path" },
  { key: "description", labelKey: "firewall.map_field_description", required: false, defaultCol: "Description" },
  { key: "notes", labelKey: "firewall.map_field_notes", required: false, defaultCol: "Notes" },
];

export default function CsvImportMappingDialog({ open, onOpenChange, file, onConfirm }) {
  const { t } = useTranslation();
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});

  useEffect(() => {
    if (!open || !file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const firstLine = String(reader.result).split(/\r?\n/)[0] || "";
      const cols = parseCsvHeaderLine(firstLine);
      setHeaders(cols);
      const initial = {};
      FIELDS.forEach((f) => {
        const match = cols.find((c) => c.toLowerCase() === f.defaultCol.toLowerCase());
        initial[f.key] = match || "";
      });
      setMapping(initial);
    };
    reader.readAsText(file.slice(0, 8192));
  }, [open, file]);

  const canConfirm = FIELDS.filter((f) => f.required).every((f) => mapping[f.key]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="csv-mapping-dialog">
        <DialogHeader>
          <DialogTitle>{t("firewall.map_columns_title")}</DialogTitle>
          <DialogDescription>{t("firewall.map_columns_help")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {FIELDS.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-3">
              <span className="text-sm">
                {t(f.labelKey)}{f.required && <span className="text-destructive"> *</span>}
              </span>
              <Select value={mapping[f.key] || "none"} onValueChange={(v) => setMapping((prev) => ({ ...prev, [f.key]: v === "none" ? "" : v }))}>
                <SelectTrigger className="w-56 rounded-sm" data-testid={`csv-map-select-${f.key}`}>
                  <SelectValue placeholder={f.required ? t("firewall.map_select_column") : t("firewall.map_no_column")} />
                </SelectTrigger>
                <SelectContent>
                  {!f.required && <SelectItem value="none">{t("firewall.map_no_column")}</SelectItem>}
                  {f.required && !mapping[f.key] && <SelectItem value="none" disabled>{t("firewall.map_select_column")}</SelectItem>}
                  {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            className="mt-2 rounded-sm" disabled={!canConfirm}
            onClick={() => onConfirm(mapping)}
            data-testid="confirm-csv-mapping-btn"
          >
            {t("firewall.import_csv")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
