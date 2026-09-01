import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "@/lib/api";
import { formatError } from "@/lib/errors";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (email, password) => {
    try {
      const res = await api.post("/auth/login", { email, password });
      if (res.data.user_id) {
        setUser(res.data);
      }
      return { ok: true, data: res.data };
    } catch (e) {
      return { ok: false, error: formatError(e) };
    }
  };

  const verify2FASetup = async (setup_token, code) => {
    try {
      const res = await api.post("/auth/2fa/setup/verify", { setup_token, code });
      setUser(res.data);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatError(e) };
    }
  };

  const verify2FALogin = async (login_token, code) => {
    try {
      const res = await api.post("/auth/2fa/verify", { login_token, code });
      setUser(res.data);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatError(e) };
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, verify2FASetup, verify2FALogin, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
