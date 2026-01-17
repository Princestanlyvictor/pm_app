import { useContext, useEffect, useState, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";

interface ProjectsPageProps {
  onNavigateBack: () => void;
}

interface ProjectType {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
}

export default function ProjectsPage({ onNavigateBack }: ProjectsPageProps) {
  const { user, token } = useContext(AuthContext);
  const [projects, setProjects] = useState<ProjectType[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(response.data);
    } catch (err) {
      console.error("Failed to fetch projects", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert("Please enter a project name");
      return;
    }

    try {
      setLoading(true);
      await api.post(
        `/projects`,
        { name: newProjectName, description: newProjectDesc },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Project created successfully!");
      setNewProjectName("");
      setNewProjectDesc("");
      setShowCreateForm(false);
      fetchProjects();
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(error.response?.data?.detail || "Failed to create project");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProjects();
    }
  }, [token, fetchProjects]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5", padding: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <h1 style={{ margin: 0 }}>📁 Projects Management</h1>
        <button
          onClick={onNavigateBack}
          style={{
            padding: "10px 20px",
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: "500"
          }}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* User Info */}
      <div style={{ backgroundColor: "white", padding: 20, borderRadius: 8, marginBottom: 30, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
        <p style={{ margin: "0 0 5px 0", fontSize: 14, color: "#666" }}>
          <strong>Logged in as:</strong> {user?.email}
        </p>
        <p style={{ margin: 0, fontSize: 14, color: "#666" }}>
          <strong>Role:</strong> {user?.role?.replace('_', ' ')}
        </p>
      </div>

      {/* Create Project Button */}
      {user?.role === "project_manager" && (
        <div style={{ marginBottom: 30 }}>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              padding: "12px 24px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 16,
              fontWeight: "500"
            }}
          >
            {showCreateForm ? "✕ Cancel" : "+ Create New Project"}
          </button>
        </div>
      )}

      {/* Create Project Form */}
      {showCreateForm && (
        <div style={{ backgroundColor: "white", padding: 30, borderRadius: 8, marginBottom: 30, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <h2 style={{ marginTop: 0 }}>Create New Project</h2>
          <div style={{ marginBottom: 15 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
              Project Name <span style={{ color: "red" }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Enter project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 4,
                border: "1px solid #ddd",
                fontSize: 14,
                boxSizing: "border-box"
              }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
              Description (Optional)
            </label>
            <textarea
              placeholder="Enter project description"
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 4,
                border: "1px solid #ddd",
                fontSize: 14,
                minHeight: 100,
                fontFamily: "inherit",
                boxSizing: "border-box"
              }}
            />
          </div>
          <button
            onClick={handleCreateProject}
            disabled={loading}
            style={{
              padding: "12px 24px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: "500",
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? "Creating..." : "Create Project"}
          </button>
        </div>
      )}

      {/* Projects List */}
      <div style={{ backgroundColor: "white", padding: 30, borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>All Projects ({projects.length})</h2>
          <button
            onClick={fetchProjects}
            disabled={loading}
            style={{
              padding: "8px 16px",
              backgroundColor: "#17a2b8",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: "500"
            }}
          >
            {loading ? "Loading..." : "🔄 Refresh"}
          </button>
        </div>

        {loading && projects.length === 0 ? (
          <p style={{ color: "#666", textAlign: "center", padding: 40 }}>Loading projects...</p>
        ) : projects.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {projects.map((project) => (
              <div
                key={project.id}
                style={{
                  padding: 20,
                  backgroundColor: "#f8f9fa",
                  border: "2px solid #e9ecef",
                  borderRadius: 8,
                  transition: "all 0.3s ease",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#007bff";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,123,255,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e9ecef";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <h3 style={{ margin: "0 0 10px 0", color: "#2c3e50", fontSize: 18 }}>
                  📁 {project.name}
                </h3>
                <p style={{ margin: "0 0 15px 0", color: "#666", fontSize: 14, minHeight: 40 }}>
                  {project.description || "No description provided"}
                </p>
                <div style={{ borderTop: "1px solid #dee2e6", paddingTop: 10 }}>
                  <p style={{ margin: "5px 0", fontSize: 12, color: "#999" }}>
                    <strong>Created by:</strong> {project.created_by}
                  </p>
                  <p style={{ margin: "5px 0", fontSize: 12, color: "#999" }}>
                    <strong>Created:</strong> {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 60, color: "#999" }}>
            <p style={{ fontSize: 18, marginBottom: 10 }}>📂 No projects yet</p>
            <p style={{ fontSize: 14 }}>
              {user?.role === "project_manager" 
                ? "Create your first project to get started!"
                : "Projects will appear here once created by the Project Manager"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
