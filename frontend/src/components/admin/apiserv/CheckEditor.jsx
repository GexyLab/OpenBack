import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CHECK_TYPES = [
  "ip_whitelist", "ip_blacklist", "body_size_limit", "required_fields",
  "json_schema", "rate_limit", "api_key",
];

export default function CheckEditor({ check, index, onChange, onRemove, apiKeys = [] }) {
  const { t } = useTranslation();
  const update = (patch) => onChange(index, { ...check, ...patch });
  const updateConfig = (patch) => onChange(index, { ...check, config: { ...check.config, ...patch } });

  return (
    <div className="space-y-2.5 border border-border bg-background p-3" data-testid={`check-editor-${index}`}>
      <div className="flex items-center gap-2">
        <Select value={check.type} onValueChange={(v) => onChange(index, { ...check, type: v, config: {} })}>
          <SelectTrigger className="h-8 flex-1 rounded-sm text-xs" data-testid={`check-type-${index}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHECK_TYPES.map((ct) => (
              <SelectItem key={ct} value={ct}>{t(`firewall.check_${ct}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Switch checked={check.enabled} onCheckedChange={(v) => update({ enabled: v })} data-testid={`check-enabled-${index}`} />
        <Button size="icon" variant="ghost" onClick={() => onRemove(index)} data-testid={`check-remove-${index}`}>
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>

      {(check.type === "ip_whitelist" || check.type === "ip_blacklist") && (
        <Textarea
          placeholder={t("firewall.ips_placeholder")}
          value={check.config.ips_text || ""}
          onChange={(e) => updateConfig({ ips_text: e.target.value })}
          className="text-xs" rows={3}
          data-testid={`check-config-ips-${index}`}
        />
      )}

      {check.type === "body_size_limit" && (
        <Input
          type="number" placeholder={t("firewall.max_bytes")}
          value={check.config.max_bytes ?? ""}
          onChange={(e) => updateConfig({ max_bytes: e.target.value })}
          className="h-8 text-xs" data-testid={`check-config-max-bytes-${index}`}
        />
      )}

      {check.type === "required_fields" && (
        <div className="space-y-2">
          <Select value={check.config.location || "body"} onValueChange={(v) => updateConfig({ location: v })}>
            <SelectTrigger className="h-8 w-40 rounded-sm text-xs" data-testid={`check-config-location-${index}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="body">Body</SelectItem>
              <SelectItem value="query">Query</SelectItem>
              <SelectItem value="headers">Headers</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            placeholder={t("firewall.fields_placeholder")}
            value={check.config.fields_text || ""}
            onChange={(e) => updateConfig({ fields_text: e.target.value })}
            className="text-xs" rows={3}
            data-testid={`check-config-fields-${index}`}
          />
        </div>
      )}

      {check.type === "json_schema" && (
        <Textarea
          placeholder='{"type":"object","required":["field"]}'
          value={check.config.schema_text || ""}
          onChange={(e) => updateConfig({ schema_text: e.target.value })}
          className="font-mono text-xs" rows={4}
          data-testid={`check-config-schema-${index}`}
        />
      )}

      {check.type === "api_key" && (
        <div className="space-y-2">
          <Input
            placeholder="X-API-Key"
            value={check.config.header_name || ""}
            onChange={(e) => updateConfig({ header_name: e.target.value })}
            className="h-8 text-xs" data-testid={`check-config-header-name-${index}`}
          />
          <div>
            <p className="mb-1 text-xs text-muted-foreground">{t("firewall.saved_keys")}</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-full justify-start rounded-sm text-xs" data-testid={`check-config-saved-keys-trigger-${index}`}>
                  {(check.config.selected_key_ids || []).length > 0
                    ? t("firewall.keys_selected_count", { count: (check.config.selected_key_ids || []).length })
                    : t("firewall.select_saved_keys")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" data-testid={`check-config-saved-keys-popover-${index}`}>
                {apiKeys.length === 0 && (
                  <p className="p-1 text-xs text-muted-foreground">{t("api_keys.no_keys")}</p>
                )}
                <div className="max-h-48 space-y-1.5 overflow-y-auto">
                  {apiKeys.map((k) => {
                    const selected = (check.config.selected_key_ids || []).includes(k.id);
                    return (
                      <label key={k.id} className="flex items-center gap-2 rounded-sm p-1 text-xs hover:bg-accent" data-testid={`check-config-saved-key-${index}-${k.id}`}>
                        <Checkbox
                          checked={selected}
                          onCheckedChange={(v) => {
                            const current = check.config.selected_key_ids || [];
                            updateConfig({ selected_key_ids: v ? [...current, k.id] : current.filter((id) => id !== k.id) });
                          }}
                        />
                        {k.name}
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Textarea
            placeholder={t("firewall.keys_placeholder")}
            value={check.config.valid_keys_text || ""}
            onChange={(e) => updateConfig({ valid_keys_text: e.target.value })}
            className="text-xs" rows={2}
            data-testid={`check-config-keys-${index}`}
          />
        </div>
      )}

      {check.type === "rate_limit" && (
        <div className="grid grid-cols-3 gap-2">
          <Input
            type="number" placeholder={t("firewall.limit")}
            value={check.config.limit ?? ""}
            onChange={(e) => updateConfig({ limit: e.target.value })}
            className="h-8 text-xs" data-testid={`check-config-limit-${index}`}
          />
          <Input
            type="number" placeholder={t("firewall.window_seconds")}
            value={check.config.window_seconds ?? ""}
            onChange={(e) => updateConfig({ window_seconds: e.target.value })}
            className="h-8 text-xs" data-testid={`check-config-window-${index}`}
          />
          <Input
            placeholder="ip / header:X-Foo"
            value={check.config.key || ""}
            onChange={(e) => updateConfig({ key: e.target.value })}
            className="h-8 text-xs" data-testid={`check-config-key-${index}`}
          />
        </div>
      )}
    </div>
  );
}
