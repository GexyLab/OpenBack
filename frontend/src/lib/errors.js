import i18n from "@/i18n";

function pickLocale(str) {
  if (typeof str !== "string" || !str.includes(" / ")) return str;
  const parts = str.split(" / ");
  if (parts.length !== 2) return str;
  return (i18n.language || "it").startsWith("en") ? parts[1] : parts[0];
}

export function formatError(e, fallback = "Errore") {
  const detail = e?.response?.data?.detail;
  if (detail == null) return e?.message || fallback;
  if (typeof detail === "string") return pickLocale(detail);
  if (Array.isArray(detail)) {
    const msg = detail.map((d) => (d && typeof d.msg === "string" ? pickLocale(d.msg) : JSON.stringify(d))).filter(Boolean).join(" ");
    return msg || fallback;
  }
  if (detail && typeof detail.msg === "string") return pickLocale(detail.msg);
  return fallback;
}
