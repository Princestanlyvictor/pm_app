import { useMemo, useState } from "react";
import type { ProjectDoc } from "../../types/projectWorkspace";

interface ProjectDocsTabProps {
  docs: ProjectDoc[];
  loading: boolean;
  canEdit: boolean;
  onRefresh: () => void;
  onCreateDoc: (payload: { title: string; content: string; version: string }) => Promise<void>;
  onUpdateDoc: (docId: string, payload: { title?: string; content?: string; version?: string }) => Promise<void>;
}

export default function ProjectDocsTab({ docs, loading, canEdit, onRefresh, onCreateDoc, onUpdateDoc }: ProjectDocsTabProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("v1");
  const [content, setContent] = useState("");

  const [activeDocId, setActiveDocId] = useState<string>("");
  const activeDoc = useMemo(() => docs.find((doc) => doc._id === activeDocId), [docs, activeDocId]);
  const [editTitle, setEditTitle] = useState("");
  const [editVersion, setEditVersion] = useState("");
  const [editContent, setEditContent] = useState("");

  const handleCreateDoc = async () => {
    if (!title.trim() || !content.trim()) {
      alert("Title and content are required");
      return;
    }
    await onCreateDoc({ title, content, version });
    setShowCreate(false);
    setTitle("");
    setVersion("v1");
    setContent("");
  };

  const handleSelectDoc = (docId: string) => {
    setActiveDocId(docId);
    const selected = docs.find((doc) => doc._id === docId);
    setEditTitle(selected?.title || "");
    setEditVersion(selected?.version || "v1");
    setEditContent(selected?.content || "");
  };

  const handleUpdateDoc = async () => {
    if (!activeDocId) {
      return;
    }
    await onUpdateDoc(activeDocId, {
      title: editTitle,
      version: editVersion,
      content: editContent,
    });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 14 }}>
      <div style={{ backgroundColor: "#fff", borderRadius: 12, border: "1px solid #ECEEF5", padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h4 style={{ margin: 0 }}>Project Docs</h4>
          <button type="button" onClick={onRefresh} style={{ border: "none", borderRadius: 6, padding: "6px 8px", cursor: "pointer" }}>
            ↻
          </button>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => setShowCreate((value) => !value)}
            style={{ width: "100%", border: "none", borderRadius: 8, padding: "8px 10px", backgroundColor: "#FF7A00", color: "white", cursor: "pointer", fontWeight: 700, marginBottom: 10 }}
          >
            {showCreate ? "Cancel" : "New Document"}
          </button>
        )}

        {showCreate && canEdit && (
          <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <input placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #d9dcea" }} />
            <input placeholder="Version" value={version} onChange={(event) => setVersion(event.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #d9dcea" }} />
            <textarea placeholder="Content" value={content} onChange={(event) => setContent(event.target.value)} style={{ minHeight: 80, padding: 8, borderRadius: 8, border: "1px solid #d9dcea" }} />
            <button type="button" onClick={handleCreateDoc} style={{ border: "none", borderRadius: 8, padding: "8px 10px", backgroundColor: "#0E0A3C", color: "white", cursor: "pointer" }}>
              Save
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ color: "#6B7280" }}>Loading docs...</div>
        ) : docs.length === 0 ? (
          <div style={{ color: "#6B7280" }}>No documentation yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {docs.map((doc) => (
              <button
                key={doc._id}
                type="button"
                onClick={() => handleSelectDoc(doc._id || "")}
                style={{
                  border: "1px solid #ECEEF5",
                  borderRadius: 8,
                  padding: "8px 10px",
                  textAlign: "left",
                  backgroundColor: activeDocId === doc._id ? "#EFF2FF" : "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600 }}>{doc.title}</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>{doc.version}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ backgroundColor: "#fff", borderRadius: 12, border: "1px solid #ECEEF5", padding: 14 }}>
        {!activeDoc ? (
          <div style={{ color: "#6B7280" }}>Select a document to view and edit.</div>
        ) : canEdit ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 8, marginBottom: 10 }}>
              <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #d9dcea" }} />
              <input value={editVersion} onChange={(event) => setEditVersion(event.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #d9dcea" }} />
            </div>
            <textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} style={{ width: "100%", minHeight: 280, padding: 10, borderRadius: 8, border: "1px solid #d9dcea", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }} />
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#6B7280", fontSize: 12 }}>Last updated by {activeDoc.last_updated_by || "Unknown"}</div>
              <button type="button" onClick={handleUpdateDoc} style={{ border: "none", borderRadius: 8, padding: "8px 12px", backgroundColor: "#0E0A3C", color: "white", cursor: "pointer", fontWeight: 700 }}>
                Update Document
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 style={{ marginTop: 0 }}>{activeDoc.title}</h3>
            <div style={{ color: "#6B7280", fontSize: 12, marginBottom: 10 }}>Version {activeDoc.version}</div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{activeDoc.content}</div>
          </>
        )}
      </div>
    </div>
  );
}
