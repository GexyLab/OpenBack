import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Boxes, Sun, Moon, Globe, ShieldCheck, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { login, verify2FASetup, verify2FALogin } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState("credentials"); // credentials | 2fa-setup | 2fa-verify
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingToken, setPendingToken] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [secret, setSecret] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleLang = () => {
    const next = i18n.language === "it" ? "en" : "it";
    i18n.changeLanguage(next);
    localStorage.setItem("gexylab_lang", next);
  };

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.data.requires_2fa_setup) {
      setPendingToken(res.data.setup_token);
      setQrCode(res.data.qr_code_base64);
      setSecret(res.data.secret);
      setStep("2fa-setup");
    } else if (res.data.requires_2fa) {
      setPendingToken(res.data.login_token);
      setStep("2fa-verify");
    } else if (res.data.user_id) {
      navigate("/");
    }
  };

  const handleVerifySetup = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await verify2FASetup(pendingToken, code);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    navigate("/");
  };

  const handleVerifyLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await verify2FALogin(pendingToken, code);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    navigate("/");
  };

  return (
    <div className="relative flex h-screen w-screen items-center justify-center bg-background overflow-hidden">
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <Button variant="ghost" size="sm" onClick={toggleLang} data-testid="login-lang-toggle" className="gap-1.5 text-xs font-bold uppercase">
          <Globe className="h-4 w-4" /> {i18n.language}
        </Button>
        <Button variant="ghost" size="icon" data-testid="login-theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
      <img
        src="https://images.unsplash.com/photo-1690983320828-c01b88baacb0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNzl8MHwxfHNlYXJjaHwzfHxhYnN0cmFjdCUyMGRhcmslMjB0ZXh0dXJlJTIwbmV1dHJhbHxlbnwwfHx8fDE3ODc1ODE0ODR8MA&ixlib=rb-4.1.0&q=85"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-20"
      />
      <div className="relative z-10 w-full max-w-sm border border-border bg-card p-8" data-testid="login-card">
        <div className="mb-6 flex items-center gap-2.5">
          <Boxes className="h-8 w-8 text-primary" strokeWidth={2.5} />
          <span className="text-2xl font-black tracking-tighter">{t("login.title")}</span>
        </div>

        {step === "credentials" && (
          <>
            <p className="mb-6 text-sm text-muted-foreground">{t("login.subtitle")}</p>
            <form onSubmit={handleCredentialsSubmit} className="space-y-3">
              <div>
                <Label className="text-xs">{t("login.email")}</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="login-email-input" />
              </div>
              <div>
                <Label className="text-xs">{t("login.password")}</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password-input" />
              </div>
              {error && <p className="text-xs text-destructive" data-testid="login-error">{error}</p>}
              <Button type="submit" className="w-full rounded-sm" disabled={loading} data-testid="login-submit-btn">
                {loading ? t("common.loading") : t("login.submit")}
              </Button>
            </form>
          </>
        )}

        {step === "2fa-setup" && (
          <form onSubmit={handleVerifySetup} className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-primary" /> {t("login.setup_2fa_title")}
            </div>
            <p className="text-xs text-muted-foreground">{t("login.setup_2fa_desc")}</p>
            {qrCode && (
              <img src={`data:image/png;base64,${qrCode}`} alt="QR" className="mx-auto h-40 w-40 border border-border" data-testid="totp-qr-code" />
            )}
            {secret && (
              <p className="text-center font-mono text-xs text-muted-foreground break-all" data-testid="totp-secret">{secret}</p>
            )}
            <div>
              <Label className="text-xs">{t("login.otp_code")}</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} required data-testid="totp-setup-code-input" />
            </div>
            {error && <p className="text-xs text-destructive" data-testid="login-error">{error}</p>}
            <Button type="submit" className="w-full rounded-sm" disabled={loading} data-testid="verify-2fa-setup-btn">
              {loading ? t("common.loading") : t("login.verify_and_activate")}
            </Button>
          </form>
        )}

        {step === "2fa-verify" && (
          <form onSubmit={handleVerifyLogin} className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-4 w-4 text-primary" /> {t("login.verify_2fa_title")}
            </div>
            <p className="text-xs text-muted-foreground">{t("login.verify_2fa_desc")}</p>
            <div>
              <Label className="text-xs">{t("login.otp_code")}</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} required autoFocus data-testid="totp-login-code-input" />
            </div>
            {error && <p className="text-xs text-destructive" data-testid="login-error">{error}</p>}
            <Button type="submit" className="w-full rounded-sm" disabled={loading} data-testid="verify-2fa-login-btn">
              {loading ? t("common.loading") : t("login.verify")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
