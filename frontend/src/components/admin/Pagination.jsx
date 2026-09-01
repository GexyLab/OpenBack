import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Pagination({ page, totalPages, onPageChange, pageSize, onPageSizeChange, pageSizeOptions = [10, 25, 50, 100] }) {
  const { t } = useTranslation();

  const pages = [];
  const windowSize = 2;
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= page - windowSize && p <= page + windowSize)) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3" data-testid="pagination-bar">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{t("audit.rows_per_page")}</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-8 w-20 rounded-sm text-xs" data-testid="pagination-page-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="icon" variant="outline" className="h-8 w-8 rounded-sm"
          disabled={page <= 1} onClick={() => onPageChange(page - 1)}
          data-testid="pagination-prev-btn"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              data-testid={`pagination-page-${p}`}
              className={`h-8 min-w-8 rounded-sm border px-2 text-xs font-medium transition-colors duration-150 ${
                p === page ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"
              }`}
            >
              {p}
            </button>
          )
        )}
        <Button
          size="icon" variant="outline" className="h-8 w-8 rounded-sm"
          disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
          data-testid="pagination-next-btn"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
