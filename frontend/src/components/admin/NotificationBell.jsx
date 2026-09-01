import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, CheckCheck } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function NotificationBell() {
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const load = () => {
    api.get("/notifications").then((res) => {
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unread_count);
    }).catch(() => {});
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const markRead = async (id) => {
    await api.post(`/notifications/${id}/read`);
    load();
  };

  const markAllRead = async () => {
    await api.post("/notifications/read-all");
    load();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="notification-bell-btn">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none"
              data-testid="notification-unread-count"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 rounded-sm p-0" align="end" data-testid="notification-popover">
        <div className="flex items-center justify-between border-b border-border p-3">
          <p className="text-sm font-bold">{t("notifications.title")}</p>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
              data-testid="mark-all-read-btn"
            >
              <CheckCheck className="h-3 w-3" /> {t("notifications.mark_all_read")}
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="p-4 text-center text-xs text-muted-foreground" data-testid="no-notifications-text">
              {t("notifications.no_notifications")}
            </p>
          )}
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.read && markRead(n.id)}
              data-testid={`notification-item-${n.id}`}
              className={`block w-full border-b border-border p-3 text-left text-xs transition-colors duration-150 hover:bg-accent ${
                n.read ? "opacity-60" : "bg-accent/40"
              }`}
            >
              <p className="font-semibold">{n.title}</p>
              <p className="mt-0.5 text-muted-foreground">{n.message}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {new Date(n.created_at).toLocaleString(i18n.language)}
              </p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
