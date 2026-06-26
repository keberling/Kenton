import { Loader2, Shield } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { APP_BASE } from "../lib/routes";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { ready, config, user, login, signingIn } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="animate-spin text-cyan-300" size={28} />
      </div>
    );
  }

  if (!config.enabled || !config.viewRequired) {
    return children;
  }

  if (user) {
    return children;
  }

  if (location.pathname.startsWith(APP_BASE)) {
    return (
      <div className="theme-root relative flex min-h-dvh items-center justify-center px-6">
        <div className="panel window max-w-md rounded-2xl px-6 py-8 text-center">
          <Shield size={28} className="mx-auto text-cyan-300" />
          <h2 className="font-display mt-4 text-2xl font-bold text-white">Staff sign-in required</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/45">
            Field uploads stay public at the home page. Sign in with Microsoft to manage deployments,
            match photos, and run backups.
          </p>
          <button
            type="button"
            onClick={() => void login()}
            disabled={signingIn}
            className="btn-primary mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
          >
            {signingIn ? "Redirecting…" : "Sign in with Microsoft"}
          </button>
        </div>
      </div>
    );
  }

  return <Navigate to="/" replace />;
}