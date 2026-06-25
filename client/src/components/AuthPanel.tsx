import { Loader2, LogIn, LogOut, Shield } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { TechMeta, TechMetaRow, TechStatusChip } from "./TechMeta";
import { shortId } from "../lib/format";

export function AuthPanel({ compact }: { compact?: boolean }) {
  const { ready, config, user, accountLabel, signingIn, login, logout } = useAuth();

  if (!ready) {
    return (
      <div className={`flex items-center gap-2 ${compact ? "" : "px-1"}`}>
        <Loader2 size={14} className="animate-spin t-faint" />
        {!compact && <span className="font-mono text-[10px] t-faint">AUTH::init</span>}
      </div>
    );
  }

  if (!config.enabled) {
    if (compact) return null;
    return (
      <div className="border-t border-theme px-4 py-4">
        <p className="hud-label mb-2 flex items-center gap-2">
          <Shield size={12} />
          Identity
        </p>
        <p className="font-mono text-[10px] leading-relaxed t-faint">
          Microsoft SSO not configured. Set AZURE_CLIENT_ID and AZURE_TENANT_ID to enable user-attributed uploads.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={compact ? "" : "border-t border-theme p-4"}>
        {!compact && (
          <p className="hud-label mb-3 flex items-center gap-2">
            <Shield size={12} />
            Microsoft identity
          </p>
        )}
        <button
          onClick={() => void login()}
          disabled={signingIn}
          className={`btn-primary inline-flex items-center gap-2 rounded-xl text-sm disabled:opacity-50 ${
            compact ? "px-3 py-2" : "w-full justify-center px-4 py-3"
          }`}
        >
          {signingIn ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
          {signingIn ? "Redirecting…" : compact ? "Sign in" : "Sign in with Microsoft"}
        </button>
        {config.required && !compact && (
          <p className="mt-2 font-mono text-[9px] t-faint">Required for field ingest</p>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <button
        onClick={() => void logout()}
        className="glass-badge inline-flex max-w-[10rem] items-center gap-2 truncate rounded-full px-3 py-1.5"
        title={user.email ?? user.displayName}
      >
        <Shield size={12} className="t-accent shrink-0" />
        <span className="truncate font-mono text-xs t-muted">{accountLabel}</span>
      </button>
    );
  }

  return (
    <div className="border-t border-theme p-4">
      <p className="hud-label mb-3 flex items-center gap-2">
        <Shield size={12} />
        Signed in
      </p>
      <div className="neu-inset rounded-xl p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium t-fg">{user.displayName}</p>
            <p className="truncate font-mono text-[10px] t-faint">{user.email ?? user.preferredUsername}</p>
          </div>
          <TechStatusChip code="MS" label="ENTRA" tone="cyan" />
        </div>
        <TechMetaRow>
          <TechMeta label="OID" value={shortId(user.microsoftOid, 8)} accent="muted" />
          {user.jobTitle && <TechMeta label="Role" value={user.jobTitle} accent="muted" />}
          {user.department && <TechMeta label="Dept" value={user.department} accent="violet" />}
          {user.officeLocation && <TechMeta label="Site" value={user.officeLocation} accent="muted" />}
        </TechMetaRow>
      </div>
      <button
        onClick={() => void logout()}
        className="btn-ghost mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm"
      >
        <LogOut size={14} />
        Sign out
      </button>
    </div>
  );
}