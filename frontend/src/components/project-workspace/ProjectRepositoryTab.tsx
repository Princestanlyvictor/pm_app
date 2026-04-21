import { useEffect, useState } from "react";
import type { RepositoryPayload } from "../../types/projectWorkspace";

interface ProjectRepositoryTabProps {
  repository: RepositoryPayload | null;
  loading: boolean;
  canEdit: boolean;
  onRefresh: () => void;
  onSave: (payload: { repo_url: string; default_branch: string }) => Promise<void>;
}

export default function ProjectRepositoryTab({ repository, loading, canEdit, onRefresh, onSave }: ProjectRepositoryTabProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!repository) {
      return;
    }
    setRepoUrl(repository.repo_url || "");
    setDefaultBranch(repository.default_branch || "main");
  }, [repository]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave({ repo_url: repoUrl, default_branch: defaultBranch });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16 }}>Loading repository settings...</div>;
  }

  return (
    <div style={{ backgroundColor: "#fff", border: "1px solid #ECEEF5", boxShadow: "0 6px 20px rgba(14,10,60,0.06)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Repository Integration</h3>
        <button type="button" onClick={onRefresh} style={{ border: "none", borderRadius: 8, padding: "8px 12px", backgroundColor: "#EEF0F6", cursor: "pointer", fontWeight: 600 }}>
          Refresh
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ fontWeight: 600, color: "#0E0A3C" }}>Repository URL</label>
        <input
          value={repoUrl}
          onChange={(event) => setRepoUrl(event.target.value)}
          disabled={!canEdit}
          placeholder="https://github.com/org/repo"
          style={{ padding: 10, borderRadius: 8, border: "1px solid #d9dcea" }}
        />

        <label style={{ fontWeight: 600, color: "#0E0A3C" }}>Default Branch</label>
        <input
          value={defaultBranch}
          onChange={(event) => setDefaultBranch(event.target.value)}
          disabled={!canEdit}
          placeholder="main"
          style={{ padding: 10, borderRadius: 8, border: "1px solid #d9dcea" }}
        />
      </div>

      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "#6B7280" }}>
          {repository?.updated_at ? `Last updated: ${new Date(repository.updated_at).toLocaleString()}` : "No repository metadata configured yet."}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ border: "none", borderRadius: 8, padding: "9px 14px", backgroundColor: "#FF7A00", color: "white", cursor: "pointer", fontWeight: 700 }}
          >
            {saving ? "Saving..." : "Save Repository"}
          </button>
        )}
      </div>
    </div>
  );
}
