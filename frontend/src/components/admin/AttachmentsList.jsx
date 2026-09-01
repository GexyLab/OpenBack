import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Paperclip, Upload, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmDeleteButton from "@/components/admin/ConfirmDeleteButton";

function formatSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function AttachmentsList({ attachments, onUpload, onDelete, onDownload, canEdit }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);

  return (
    <div data-testid="attachments-list">
      {canEdit && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="mb-3 gap-2 rounded-sm w-full"
            onClick={() => fileRef.current?.click()}
            data-testid="upload-attachment-btn"
          >
            <Upload className="h-4 w-4" /> {t("project_detail.upload_attachment")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => e.target.files[0] && onUpload(e.target.files[0])}
            data-testid="attachment-file-input"
          />
        </>
      )}
      {!attachments.length ? (
        <p className="text-sm text-muted-foreground" data-testid="no-attachments-text">
          {t("project_detail.no_attachments")}
        </p>
      ) : (
        <div className="space-y-2">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between border border-border bg-background p-2.5"
              data-testid={`attachment-item-${a.id}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm truncate">{a.filename}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatSize(a.size)} · {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onDownload(a)} data-testid={`attachment-download-${a.id}`}>
                  <Download className="h-4 w-4 text-muted-foreground hover:text-primary" />
                </button>
                {canEdit && (
                  <ConfirmDeleteButton testId={`attachment-delete-${a.id}`} onConfirm={() => onDelete(a.id)}>
                    <button><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>
                  </ConfirmDeleteButton>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
