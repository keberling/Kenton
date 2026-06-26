import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { activeAccount, getMsal } from "../lib/auth/msal";
import { useAuth } from "../lib/AuthContext";
import { APP_BASE } from "../lib/routes";

export function AuthRedirectHandler() {
  const { config, user, ready } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready || !config.enabled) return;
    const instance = getMsal();
    if (!instance) return;

    const account = activeAccount(instance);
    if (!account) return;

    if (location.pathname === "/" && config.viewRequired && user) {
      navigate(`${APP_BASE}/sites`, { replace: true });
    }
  }, [config.enabled, config.viewRequired, location.pathname, navigate, ready, user]);

  return null;
}