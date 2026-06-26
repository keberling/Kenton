import { KeyRound, Save } from "lucide-react";
import { useState } from "react";
import { saveAutotaskConfig } from "../lib/api";

interface AutotaskCredentialsFormProps {
  initialUsername?: string;
  onSaved?: (message: string) => void;
  onError?: (message: string) => void;
  compact?: boolean;
}

export function AutotaskCredentialsForm({
  initialUsername = "",
  onSaved,
  onError,
  compact = false,
}: AutotaskCredentialsFormProps) {
  const [username, setUsername] = useState(initialUsername);
  const [secret, setSecret] = useState("");
  const [integrationCode, setIntegrationCode] = useState("");
  const [zoneUrl, setZoneUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !secret.trim() || !integrationCode.trim()) return;

    setSaving(true);
    try {
      const result = await saveAutotaskConfig({
        username: username.trim(),
        secret: secret,
        integrationCode: integrationCode.trim(),
        zoneUrl: zoneUrl.trim() || undefined,
      });
      if (!result.ok) throw new Error(result.error ?? "Connection failed");
      setSecret("");
      onSaved?.(
        `Autotask connected — ${result.zoneName ?? "zone resolved"}${result.webUrl ? ` (${result.webUrl})` : ""}.`,
      );
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Could not save Autotask credentials");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {!compact && (
        <p className="text-sm leading-relaxed text-white/45">
          Paste credentials from the API-only user&apos;s <strong className="text-white/70">Security</strong> tab.
          Saved on the server (handles passwords with <code className="font-mono text-[11px]">$</code> that Coolify env vars break).
          Use <span className="font-mono text-[11px]">Tracking Identifier</span>, not the integration name.
        </p>
      )}

      <label className="block">
        <span className="hud-label mb-1.5 block">Username (Key)</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="apiuser@company.com"
          className="input-field w-full rounded-xl px-4 py-2.5 font-mono text-sm"
          required
        />
      </label>

      <label className="block">
        <span className="hud-label mb-1.5 block">Password (Secret)</span>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="From Autotask — paste exactly"
          className="input-field w-full rounded-xl px-4 py-2.5 font-mono text-sm"
          required
          autoComplete="off"
        />
      </label>

      <label className="block">
        <span className="hud-label mb-1.5 block">Tracking identifier</span>
        <input
          value={integrationCode}
          onChange={(e) => setIntegrationCode(e.target.value)}
          placeholder="FSVD5C… (Custom Internal Integration)"
          className="input-field w-full rounded-xl px-4 py-2.5 font-mono text-sm"
          required
          autoComplete="off"
        />
      </label>

      <label className="block">
        <span className="hud-label mb-1.5 block">Zone URL (optional)</span>
        <input
          value={zoneUrl}
          onChange={(e) => setZoneUrl(e.target.value)}
          placeholder="Leave blank — auto-detects ww22"
          className="input-field w-full rounded-xl px-4 py-2.5 font-mono text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
      >
        {compact ? <KeyRound size={14} /> : <Save size={14} />}
        {saving ? "Saving & testing…" : compact ? "Update credentials" : "Save & test connection"}
      </button>
    </form>
  );
}