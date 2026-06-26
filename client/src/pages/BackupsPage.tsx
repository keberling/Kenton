import { Download, HardDrive, Loader2, Play, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { TechMeta, TechMetaRow, TechStatusChip } from "../components/TechMeta";
import { useLivePoll } from "../lib/LiveDataContext";
import { downloadBackup, getBackups, runBackup, type BackupRecord, type BackupStatus } from "../lib/api";
import { formatBytes, formatDate } from "../lib/format";

export function BackupsPage() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getBackups()
      .then((result) => {
        setBackups(result.backups);
        setStatus(result.status);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load backups"));
  }, []);

  useLivePoll(load, []);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      const result = await runBackup();
      setMessage(
        result.backup.status === "uploaded"
          ? `Backup created and uploaded to SharePoint (${formatBytes(result.backup.sizeBytes)}).`
          : result.backup.status === "failed"
            ? `Backup archived locally but SharePoint upload failed: ${result.backup.error}`
            : `Backup archived locally (${formatBytes(result.backup.sizeBytes)}).`,
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Backups"
        description="Nightly database and image archive to SharePoint. Keep the last 10 backups and run an on-demand snapshot any time."
        action={
          <div className="flex flex-wrap gap-2">
            <TechStatusChip
              code="SP"
              label={status?.sharePointConfigured ? "SharePoint ready" : "Local only"}
              tone={status?.sharePointConfigured ? "emerald" : "amber"}
            />
            <button
              type="button"
              onClick={() => void handleRun()}
              disabled={running || !status?.enabled}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {running ? "Running…" : "Run backup now"}
            </button>
          </div>
        }
      />

      {status && (
        <section className="panel window rounded-2xl px-5 py-4">
          <TechMetaRow>
            <TechMeta label="Enabled" value={status.enabled ? "yes" : "no"} accent={status.enabled ? "emerald" : "rose"} />
            <TechMeta label="Retention" value={`${status.retention} backups`} accent="muted" />
            <TechMeta label="Schedule" value={status.cron} accent="muted" />
            <TechMeta label="Timezone" value={status.timezone} accent="muted" />
            <TechMeta
              label="SharePoint"
              value={status.siteUrl ? status.siteUrl.replace(/^https?:\/\//, "") : "not configured"}
              accent={status.sharePointConfigured ? "cyan" : "amber"}
            />
            <TechMeta label="Folder" value={status.folderPath} accent="muted" />
          </TechMetaRow>
        </section>
      )}

      {status && !status.sharePointConfigured && (
        <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
          SharePoint destination is not configured. Set the site URL and folder in{" "}
          <Link to="settings" className="text-cyan-300 underline underline-offset-2">
            Settings
          </Link>
          .
        </p>
      )}

      {message && <p className="font-mono text-sm text-emerald-400">{message}</p>}
      {error && <p className="font-mono text-sm text-rose-400">{error}</p>}

      <section className="panel window overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <p className="hud-label text-cyan-300/80">Backup history</p>
          <button type="button" onClick={load} className="btn-ghost rounded-lg p-2 text-white/40">
            <RefreshCw size={14} />
          </button>
        </div>

        {backups.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-white/40">No backups recorded yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {backups.map((backup) => (
              <li key={backup.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{backup.filename}</p>
                  <p className="mt-1 font-mono text-[10px] text-white/35">
                    {formatDate(backup.createdAt)} · {formatBytes(backup.sizeBytes)} · {backup.trigger}
                    {backup.status === "uploaded" ? " · SharePoint" : backup.status === "failed" ? " · upload failed" : " · local"}
                  </p>
                  {backup.error && <p className="mt-1 text-xs text-rose-300/80">{backup.error}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {backup.sharePointWebUrl && (
                    <a
                      href={backup.sharePointWebUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost rounded-lg px-3 py-2 text-xs"
                    >
                      SharePoint
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void downloadBackup(backup.id, backup.filename)}
                    className="btn-primary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                  >
                    <Download size={12} />
                    Download
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel window rounded-2xl px-5 py-4">
        <div className="flex items-start gap-3">
          <HardDrive size={18} className="mt-0.5 text-cyan-300" />
          <p className="text-sm leading-relaxed text-white/45">
            Each backup is a <code className="text-cyan-200/80">.tar.gz</code> containing{" "}
            <code className="text-cyan-200/80">kenton.db</code> and the{" "}
            <code className="text-cyan-200/80">uploads/</code> folder. Nightly jobs prune anything
            older than the retention count in both local storage and SharePoint.
          </p>
        </div>
      </section>
    </div>
  );
}