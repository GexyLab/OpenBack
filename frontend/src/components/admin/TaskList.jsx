import { useTranslation } from "react-i18next";
import { CheckSquare, Square, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ConfirmDeleteButton from "@/components/admin/ConfirmDeleteButton";

const STATUS_ORDER = ["todo", "in_progress", "done"];

export default function TaskList({ tasks, onCycleStatus, onDelete, canEdit, showProject }) {
  const { t } = useTranslation();

  const statusLabel = (s) => t(`project_detail.status_${s}`);
  const priorityVariant = (p) => (p === "high" ? "destructive" : p === "medium" ? "default" : "secondary");

  if (!tasks.length) {
    return <p className="text-sm text-muted-foreground" data-testid="no-tasks-text">{t("project_detail.no_tasks")}</p>;
  }

  return (
    <div className="space-y-2" data-testid="task-list">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-center justify-between border border-border bg-background p-3"
          data-testid={`task-item-${task.id}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => canEdit && onCycleStatus(task)} data-testid={`task-toggle-${task.id}`} disabled={!canEdit}>
              {task.status === "done" ? (
                <CheckSquare className="h-5 w-5 text-primary" />
              ) : (
                <Square className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-medium truncate ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                  {task.title}
                </p>
                {showProject && task.project_name && (
                  <Badge variant="outline" className="text-[10px] rounded-sm shrink-0">{task.project_name}</Badge>
                )}
              </div>
              {task.description && <p className="text-xs text-muted-foreground truncate">{task.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px] rounded-sm">{statusLabel(task.status)}</Badge>
            <Badge variant={priorityVariant(task.priority)} className="text-[10px] rounded-sm">
              {t(`project_detail.priority_${task.priority}`)}
            </Badge>
            {canEdit && (
              <ConfirmDeleteButton testId={`task-delete-${task.id}`} onConfirm={() => onDelete(task.id)}>
                <button><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>
              </ConfirmDeleteButton>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
