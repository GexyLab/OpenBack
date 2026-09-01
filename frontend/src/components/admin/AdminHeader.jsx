import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { Sun, Moon, Globe, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import NotificationBell from "@/components/admin/NotificationBell";

export default function AdminHeader() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();

  const toggleLang = () => {
    const next = i18n.language === "it" ? "en" : "it";
    i18n.changeLanguage(next);
    localStorage.setItem("gexylab_lang", next);
  };

  return (
    <header
      data-testid="admin-header"
      className="flex h-16 items-center justify-between border-b border-border bg-card px-6"
    >
      <div />
      <div className="flex items-center gap-2">
        <NotificationBell />
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLang}
          data-testid="lang-toggle-btn"
          className="gap-1.5 text-xs font-bold uppercase"
        >
          <Globe className="h-4 w-4" />
          {i18n.language}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          data-testid="theme-toggle"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <div className="flex items-center gap-2 pl-2 border-l border-border ml-1">
          <Avatar className="h-8 w-8 rounded-sm">
            <AvatarImage src={user?.picture} />
            <AvatarFallback className="rounded-sm text-xs">{user?.name?.[0]}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium hidden sm:inline" data-testid="header-user-name">
            {user?.name}
          </span>
          <Button variant="ghost" size="icon" onClick={logout} data-testid="logout-btn">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
