import { Cloud, Loader2, Save, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getSharePointBackupSettings,
  saveSharePointBackupSettings,
  testSharePointBackupSettings,
  type SharePointBackupSettings,
} from "../lib/api";

interface SharePointBackupSettingsFormProps {
  onSaved?: (message: string) => void;
  onError?: (message: string) => void;
}

export function SharePointBackupSettingsForm({ onSaved, onError }: SharePointBackupSettingsFormProps) {
  const [status, setStatus] = useState<SharePointBackupSettings | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [folderPath, setFolderPath] = useState("Kenton/Backups");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    getSharePointBackupSettings()
      .then((result) => {
        setStatus(result);
        if (result.siteUrl) setSiteUrl(result.siteUrl);
        if (result.folderPath) setFolderPath(result.folderPath);
      })
      .catch((err) => onError?.(err instanceof Error ? err.message : "Could not load settings"))
      .finally(() => setLoading(false));
  }, [onError]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteUrl.trim()) return;

    setSaving(true);
    try {
      const result = await saveSharePointBackupSettings({
        siteUrl: siteUrl.trim(),
        folderPath: folderPath.trim() || "Kenton/Backups",
      });
      setStatus(result);
      const message = result.test?.ok
        ? result.test.message
        : `Saved. ${result.test?.message ?? "Run Test connection to verify access."}`;
      onSaved?.(message);
      if (result.test && !result.test.ok) {
        onError?.(result.test.message);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Could not save SharePoint settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await testSharePointBackupSettings();
      if (result.ok) onSaved?.(result.message);
      else onError?.(result.message);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "SharePoint test failed");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/40">
        <Loader2 size={16} className="animate-spin" />
        Loading SharePoint settings…
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <p className="text-sm leading-relaxed text-white/45">
        Paste your SharePoint <strong className="text-white/70">site URL</strong> and backup folder.
        Azure client ID, tenant ID, and client secret stay in server environment variables — Kenton resolves
        the document library automatically.
      </p>

      {!status?.graphAuthReady && (
        <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
          Set <code className="font-mono text-[11px]">AZURE_CLIENT_SECRET</code> in Coolify before saving
          SharePoint settings.
        </p>
      )}

      {status?.configured && status.driveName && (
        <p className="font-mono text-xs text-emerald-300/80">
          Connected to {status.driveName}
          {status.siteUrl ? ` · ${status.siteUrl}` : ""}
        </p>
      )}

      <label className="block">
        <span className="hud-label mb-1.5 block">SharePoint site URL</span>
        <input
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          placeholder="https://yourtenant.sharepoint.com/sites/Kenton"
          className="input-field w-full rounded-xl px-4 py-2.5 font-mono text-sm"
          required
        />
      </label>

      <label className="block">
        <span className="hud-label mb-1.5 block">Backup folder</span>
        <input
          value={folderPath}
          onChange={(e) => setFolderPath(e.target.value)}
          placeholder="Kenton/Backups"
          className="input-field w-full rounded-xl px-4 py-2.5 font-mono text-sm"
        />
        <p className="mt-1.5 text-xs text-white/35">
          Folder inside the site&apos;s Documents library. Created automatically if missing.
        </p>
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving || !status?.graphAuthReady}
          className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? "Saving…" : "Save settings"}
        </button>
        <button
          type="button"
          onClick={() => void handleTest()}
          disabled={testing || !status?.configured}
          className="btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
          {testing ? "Testing…" : "Test connection"}
        </button>
      </div>

      {status?.configured && (
        <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
          <Cloud size={16} className="mt-0.5 shrink-0 text-cyan-300" />
          <p className="text-xs leading-relaxed text-white/40">
            Nightly backups upload <code className="text-cyan-200/80">kenton-backup-*.tar.gz</code> files to
            this folder. Manage retention and run manual backups from the Backups page.
          </p>
        </div>
      )}
    </form>
  );
}