import { Settings2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { SharePointBackupSettingsForm } from "../components/SharePointBackupSettingsForm";

export function SettingsPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Configure SharePoint backup destination and other integrations stored on the server."
      />

      {message && <p className="font-mono text-sm text-emerald-400">{message}</p>}
      {error && <p className="font-mono text-sm text-rose-400">{error}</p>}

      <section className="panel window rounded-2xl px-5 py-5 sm:px-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="neu-raised-sm flex h-10 w-10 items-center justify-center rounded-xl">
            <Settings2 size={18} className="text-cyan-300" />
          </div>
          <div>
            <p className="hud-label text-cyan-300/80">SharePoint backups</p>
            <p className="text-sm text-white/45">Site URL and folder for nightly database + image archives</p>
          </div>
        </div>

        <SharePointBackupSettingsForm
          onSaved={(text) => {
            setError(null);
            setMessage(text);
          }}
          onError={(text) => {
            setMessage(null);
            setError(text);
          }}
        />
      </section>
    </div>
  );
}