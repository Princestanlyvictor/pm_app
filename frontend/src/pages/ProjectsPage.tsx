import { useCallback, useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";
import ProjectOverviewTab from "../components/project-workspace/ProjectOverviewTab";
import ProjectTasksTab from "../components/project-workspace/ProjectTasksTab";
import ProjectRoadmapTab from "../components/project-workspace/ProjectRoadmapTab";
import ProjectDocsTab from "../components/project-workspace/ProjectDocsTab";
import ProjectRepositoryTab from "../components/project-workspace/ProjectRepositoryTab";
import type {
  ProjectDoc,
  ProjectMember,
  ProjectStatus,
  RepositoryPayload,
  RoadmapPayload,
  WorkspacePayload,
  WorkspaceTask,
} from "../types/projectWorkspace";

interface ProjectsPageProps {
  onNavigateBack: () => void;
}

interface ProjectType {
  id: string;
  name: string;
  description: string;
  status?: ProjectStatus;
  start_date?: string;
  end_date?: string;
  project_manager_email?: string;
  team_members?: string[];
  members_count?: number;
  created_by: string;
  created_at: string;
}

interface AuthUser {
  email: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
}

type WorkspaceTab = "overview" | "tasks" | "roadmap" | "docs" | "repository";

interface TaskFilters {
  status: string;
  assignee: string;
  priority: string;
  stage: string;
}

export default function ProjectsPage({ onNavigateBack }: ProjectsPageProps) {
  const { user, token } = useContext(AuthContext) as AuthContextValue;
  const isAdmin = user?.role === "admin" || user?.role === "project_manager";

  const [projects, setProjects] = useState<ProjectType[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectTeamMembers, setNewProjectTeamMembers] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [savingProjectEdits, setSavingProjectEdits] = useState(false);

  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectDesc, setEditProjectDesc] = useState("");
  const [editProjectStartDate, setEditProjectStartDate] = useState("");
  const [editProjectEndDate, setEditProjectEndDate] = useState("");
  const [editProjectTeamMembers, setEditProjectTeamMembers] = useState("");

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");

  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapPayload | null>(null);
  const [docs, setDocs] = useState<ProjectDoc[]>([]);
  const [repository, setRepository] = useState<RepositoryPayload | null>(null);

  const [tasksView, setTasksView] = useState<"list" | "kanban">("list");
  const [taskFilters, setTaskFilters] = useState<TaskFilters>({
    status: "",
    assignee: "",
    priority: "",
    stage: "",
  });
  const [taskList, setTaskList] = useState<WorkspaceTask[]>([]);
  const [taskKanban, setTaskKanban] = useState<Record<string, WorkspaceTask[]>>({});

  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingRepository, setLoadingRepository] = useState(false);

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"project_manager" | "developer" | "viewer">("developer");
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<ProjectStatus>("Active");

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

  const fetchWorkspace = useCallback(
    async (projectId: string) => {
      try {
        setLoadingWorkspace(true);
        const response = await api.get(`/projects/${projectId}/workspace`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setWorkspace(response.data);
        setUpdatingStatus(response.data?.project?.status || "Active");
      } catch (error) {
        console.error("Failed to fetch workspace", error);
      } finally {
        setLoadingWorkspace(false);
      }
    },
    [token]
  );

  const fetchTasks = useCallback(
    async (projectId: string, view: "list" | "kanban", filters: TaskFilters) => {
      try {
        setLoadingTasks(true);
        const params: Record<string, string> = { view };
        if (filters.status) params.status = filters.status;
        if (filters.assignee) params.assignee = filters.assignee;
        if (filters.priority) params.priority = filters.priority;
        if (filters.stage) params.stage = filters.stage;

        const response = await api.get(`/projects/${projectId}/tasks`, {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });

        if (response.data.view === "kanban") {
          setTaskKanban(response.data.items || {});
          setTaskList([]);
        } else {
          setTaskList(response.data.items || []);
          setTaskKanban({});
        }
      } catch (error) {
        console.error("Failed to fetch tasks", error);
      } finally {
        setLoadingTasks(false);
      }
    },
    [token]
  );

  const fetchRoadmap = useCallback(
    async (projectId: string) => {
      try {
        setLoadingRoadmap(true);
        const response = await api.get(`/projects/${projectId}/roadmap`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRoadmap(response.data);
      } catch (error) {
        console.error("Failed to fetch roadmap", error);
      } finally {
        setLoadingRoadmap(false);
      }
    },
    [token]
  );

  const fetchDocs = useCallback(
    async (projectId: string) => {
      try {
        setLoadingDocs(true);
        const response = await api.get(`/projects/${projectId}/docs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDocs(response.data || []);
      } catch (error) {
        console.error("Failed to fetch docs", error);
      } finally {
        setLoadingDocs(false);
      }
    },
    [token]
  );

  const fetchRepository = useCallback(
    async (projectId: string) => {
      try {
        setLoadingRepository(true);
        const response = await api.get(`/projects/${projectId}/repository`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRepository(response.data);
      } catch (error) {
        console.error("Failed to fetch repository", error);
      } finally {
        setLoadingRepository(false);
      }
    },
    [token]
  );

  const loadWorkspaceBundle = useCallback(
    async (projectId: string) => {
      await Promise.all([fetchWorkspace(projectId), fetchRoadmap(projectId), fetchDocs(projectId), fetchRepository(projectId)]);
      await fetchTasks(projectId, tasksView, taskFilters);
    },
    [fetchWorkspace, fetchRoadmap, fetchDocs, fetchRepository, fetchTasks, tasksView, taskFilters]
  );

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert("Please enter a project name");
      return;
    }

    try {
      setLoading(true);
      await api.post(
        `/projects`,
        {
          name: newProjectName,
          description: newProjectDesc,
          team_members: newProjectTeamMembers
            .split(",")
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Project created successfully!");
      setNewProjectName("");
      setNewProjectDesc("");
      setNewProjectTeamMembers("");
      setShowCreateForm(false);
      await fetchProjects();
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(error.response?.data?.detail || "Failed to create project");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProject = async (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (project) {
      setEditProjectName(project.name || "");
      setEditProjectDesc(project.description || "");
      setEditProjectStartDate(project.start_date || "");
      setEditProjectEndDate(project.end_date || "");
      setEditProjectTeamMembers((project.team_members || []).join(", "));
      setUpdatingStatus(project.status || "Active");
    }

    setShowEditForm(false);
    setShowMemberForm(false);
    setSelectedProjectId(projectId);
    setActiveTab("overview");
    await loadWorkspaceBundle(projectId);
  };

  const handleEditProject = async () => {
    if (!selectedProjectId) {
      return;
    }

    if (!editProjectName.trim()) {
      alert("Project name is required");
      return;
    }

    const teamMembers = editProjectTeamMembers
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    try {
      setSavingProjectEdits(true);

      await api.patch(
        `/projects/${selectedProjectId}/settings`,
        {
          name: editProjectName.trim(),
          description: editProjectDesc,
          status: updatingStatus,
          start_date: editProjectStartDate,
          end_date: editProjectEndDate,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await api.put(
        `/projects/${selectedProjectId}/assignments`,
        { team_members: teamMembers },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await Promise.all([fetchProjects(), fetchWorkspace(selectedProjectId)]);
      setShowEditForm(false);
      alert("Project updated successfully");
    } catch (error) {
      const typedError = error as { response?: { data?: { detail?: string } } };
      alert(typedError.response?.data?.detail || "Failed to update project");
    } finally {
      setSavingProjectEdits(false);
    }
  };

  const handleTaskFilterChange = (key: keyof TaskFilters, value: string) => {
    setTaskFilters((current) => ({ ...current, [key]: value }));
  };

  const handleCreateTask = async (payload: {
    title: string;
    description: string;
    status: string;
    priority: string;
    stage?: string;
    task_date: string;
    due_date?: string;
    estimated_time?: number;
    dependencies: string[];
    assigned_to: string[];
  }) => {
    if (!selectedProjectId) {
      return;
    }

    await api.post(
      "/reports/task",
      {
        ...payload,
        project_id: selectedProjectId,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    await Promise.all([
      fetchTasks(selectedProjectId, tasksView, taskFilters),
      fetchWorkspace(selectedProjectId),
    ]);
  };

  const handleAddMember = async () => {
    if (!selectedProjectId || !memberEmail.trim()) {
      return;
    }

    try {
      await api.post(
        `/projects/${selectedProjectId}/members`,
        { email: memberEmail, role: memberRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMemberEmail("");
      setShowMemberForm(false);
      await fetchWorkspace(selectedProjectId);
    } catch (error) {
      const typedError = error as { response?: { data?: { detail?: string } } };
      alert(typedError.response?.data?.detail || "Failed to add member");
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedProjectId) {
      return;
    }

    await api.patch(
      `/projects/${selectedProjectId}/settings`,
      { status: updatingStatus },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    await Promise.all([fetchWorkspace(selectedProjectId), fetchProjects()]);
  };

  const handleAddStage = async (name: string, description: string) => {
    if (!selectedProjectId) {
      return;
    }
    await api.post(
      `/projects/${selectedProjectId}/roadmap/stages`,
      { name, description },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    await Promise.all([fetchRoadmap(selectedProjectId), fetchWorkspace(selectedProjectId)]);
  };

  const handleAddMilestone = async (payload: { name: string; stage_id?: string; deadline?: string; description?: string }) => {
    if (!selectedProjectId) {
      return;
    }
    await api.post(`/projects/${selectedProjectId}/roadmap/milestones`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchRoadmap(selectedProjectId);
  };

  const handleUpdateMilestone = async (
    milestoneId: string,
    payload: { status?: "planned" | "in_progress" | "completed" }
  ) => {
    if (!selectedProjectId) {
      return;
    }
    await api.patch(`/projects/${selectedProjectId}/roadmap/milestones/${milestoneId}`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchRoadmap(selectedProjectId);
  };

  const handleCreateDoc = async (payload: { title: string; content: string; version: string }) => {
    if (!selectedProjectId) {
      return;
    }
    await api.post(`/projects/${selectedProjectId}/docs`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchDocs(selectedProjectId);
    await fetchWorkspace(selectedProjectId);
  };

  const handleUpdateDoc = async (docId: string, payload: { title?: string; content?: string; version?: string }) => {
    if (!selectedProjectId) {
      return;
    }
    await api.put(`/projects/${selectedProjectId}/docs/${docId}`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchDocs(selectedProjectId);
    await fetchWorkspace(selectedProjectId);
  };

  const handleSaveRepository = async (payload: { repo_url: string; default_branch: string }) => {
    if (!selectedProjectId) {
      return;
    }
    await api.patch(`/projects/${selectedProjectId}/repository`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await Promise.all([fetchRepository(selectedProjectId), fetchWorkspace(selectedProjectId)]);
  };

  useEffect(() => {
    if (token) {
      fetchProjects();
    }
  }, [token, fetchProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchTasks(selectedProjectId, tasksView, taskFilters);
    }
  }, [selectedProjectId, tasksView, taskFilters, fetchTasks]);

  const workspaceMembers: ProjectMember[] = workspace?.members || [];
  const canManageProject = workspace?.user_project_role === "project_manager";
  const canEditDocs = workspace?.user_project_role !== "viewer";
  const stages = roadmap?.stages || [];

  const selectedProject = projects.find((project) => project.id === selectedProjectId);

  const tabs: Array<{ key: WorkspaceTab; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "tasks", label: "Tasks" },
    { key: "roadmap", label: "Roadmap" },
    { key: "docs", label: "Docs" },
    { key: "repository", label: "Repository" },
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F5F6FA", padding: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <h1 style={{ margin: 0, color: "#0E0A3C" }}> Projects Management</h1>
        <button
          onClick={onNavigateBack}
          style={{
            padding: "10px 20px",
            backgroundColor: "#0E0A3C",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: "500"
          }}
        >
          Back Back to Dashboard
        </button>
      </div>

      {/* Create Project Button */}
      {isAdmin && (
        <div style={{ marginBottom: 30 }}>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              padding: "12px 24px",
              backgroundColor: "#FF7A00",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 16,
              fontWeight: "500"
            }}
          >
            {showCreateForm ? "X Cancel" : "+ Create New Project"}
          </button>
        </div>
      )}

      {/* Create Project Form */}
      {showCreateForm && (
        <div style={{ backgroundColor: "white", padding: 24, borderRadius: 12, marginBottom: 24, boxShadow: "0 6px 20px rgba(14,10,60,0.06)", border: "1px solid #ECEEF5" }}>
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
                borderRadius: 8,
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
                borderRadius: 8,
                border: "1px solid #ddd",
                fontSize: 14,
                minHeight: 100,
                fontFamily: "inherit",
                boxSizing: "border-box"
              }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
              Team Members (comma-separated emails)
            </label>
            <input
              type="text"
              placeholder="member1@company.com, member2@company.com"
              value={newProjectTeamMembers}
              onChange={(e) => setNewProjectTeamMembers(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                fontSize: 14,
                boxSizing: "border-box"
              }}
            />
          </div>
          <button
            onClick={handleCreateProject}
            disabled={loading}
            style={{
              padding: "12px 24px",
              backgroundColor: "#0E0A3C",
              color: "white",
              border: "none",
              borderRadius: 8,
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

      {/* Workspace With Sidebar */}
      {loading && projects.length === 0 ? (
        <div style={{ backgroundColor: "white", padding: 24, borderRadius: 12, boxShadow: "0 6px 20px rgba(14,10,60,0.06)", border: "1px solid #ECEEF5", marginTop: 16 }}>
          <p style={{ color: "#666", textAlign: "center", padding: 40 }}>Loading projects...</p>
        </div>
      ) : projects.length > 0 ? (
        <div style={{ display: "flex", gap: 16, marginTop: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <aside style={{ flex: "1 1 280px", minWidth: 260, maxWidth: 320, backgroundColor: "white", borderRadius: 12, border: "1px solid #ECEEF5", boxShadow: "0 6px 20px rgba(14,10,60,0.06)", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: "#0E0A3C" }}>Projects ({projects.length})</h2>
              <button
                onClick={fetchProjects}
                disabled={loading}
                style={{
                  padding: "7px 12px",
                  backgroundColor: "#0E0A3C",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            <label htmlFor="project-switch" style={{ display: "block", fontSize: 13, color: "#4B5563", fontWeight: 700, marginBottom: 8 }}>
              Switch Project
            </label>
            <select
              id="project-switch"
              value={selectedProjectId || ""}
              onChange={(event) => {
                const nextProjectId = event.target.value;
                if (nextProjectId) {
                  void handleSelectProject(nextProjectId);
                }
              }}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #D8DEEC", fontSize: 14, backgroundColor: "#fff", marginBottom: 14 }}
            >
              <option value="" disabled>
                Select a project
              </option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>

            {selectedProject ? null : (
              <div style={{ border: "1px dashed #D8DEEC", borderRadius: 10, padding: 12, color: "#6B7280", fontSize: 13 }}>
                Select a project to open its workspace.
              </div>
            )}

            {selectedProject && (
              <div style={{ marginTop: 14, borderTop: "1px solid #EEF1F8", paddingTop: 14 }}>
                <h3 style={{ margin: "0 0 4px", color: "#0E0A3C", fontSize: 22 }}>{selectedProject.name} Workspace</h3>
                <p style={{ margin: "0 0 12px", color: "#6B7280", fontSize: 14 }}>
                  {selectedProject.description || "No project description provided"}
                </p>

                <div style={{ display: "grid", gap: 8 }}>
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      style={{
                        border: "none",
                        borderRadius: 10,
                        padding: "10px 12px",
                        cursor: "pointer",
                        fontWeight: 700,
                        textAlign: "left",
                        backgroundColor: activeTab === tab.key ? "#0E0A3C" : "#EEF1F8",
                        color: activeTab === tab.key ? "white" : "#3A425A",
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <div style={{ flex: "3 1 680px", minWidth: 320 }}>
            {selectedProject ? (
              <div style={{ backgroundColor: "white", borderRadius: 12, border: "1px solid #ECEEF5", boxShadow: "0 6px 20px rgba(14,10,60,0.06)", padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setActiveTab("tasks")} style={{ border: "none", borderRadius: 8, backgroundColor: "#FF7A00", color: "white", padding: "8px 12px", cursor: "pointer", fontWeight: 700 }}>
                Add Task
              </button>

              {canManageProject && (
                <>
                  <button type="button" onClick={() => setShowEditForm((value) => !value)} style={{ border: "none", borderRadius: 8, backgroundColor: "#EAF0FF", color: "#0E0A3C", padding: "8px 12px", cursor: "pointer", fontWeight: 700 }}>
                    {showEditForm ? "Close Edit" : "Edit Project"}
                  </button>
                  <button type="button" onClick={() => setShowMemberForm((value) => !value)} style={{ border: "none", borderRadius: 8, backgroundColor: "#0E0A3C", color: "white", padding: "8px 12px", cursor: "pointer", fontWeight: 700 }}>
                    {showMemberForm ? "Cancel" : "Add Member"}
                  </button>
                  <select value={updatingStatus} onChange={(event) => setUpdatingStatus(event.target.value as ProjectStatus)} style={{ padding: 8, borderRadius: 8, border: "1px solid #D8DEEC" }}>
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                  </select>
                  <button type="button" onClick={handleUpdateStatus} style={{ border: "none", borderRadius: 8, backgroundColor: "#EAF0FF", color: "#0E0A3C", padding: "8px 10px", cursor: "pointer", fontWeight: 700 }}>
                    Update Status
                  </button>
                </>
              )}
            </div>
          </div>

          {showMemberForm && canManageProject && (
            <div style={{ marginBottom: 14, border: "1px solid #ECEEF5", borderRadius: 10, padding: 12, backgroundColor: "#FAFBFF", display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8 }}>
              <input
                placeholder="member@email.com"
                value={memberEmail}
                onChange={(event) => setMemberEmail(event.target.value)}
                style={{ padding: 9, borderRadius: 8, border: "1px solid #D8DEEC" }}
              />
              <select value={memberRole} onChange={(event) => setMemberRole(event.target.value as "project_manager" | "developer" | "viewer")} style={{ padding: 9, borderRadius: 8, border: "1px solid #D8DEEC" }}>
                <option value="project_manager">Project Manager</option>
                <option value="developer">Developer</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="button" onClick={handleAddMember} style={{ border: "none", borderRadius: 8, backgroundColor: "#FF7A00", color: "white", padding: "9px 14px", cursor: "pointer", fontWeight: 700 }}>
                Save
              </button>
            </div>
          )}

          {showEditForm && canManageProject && (
            <div style={{ marginBottom: 14, border: "1px solid #ECEEF5", borderRadius: 10, padding: 12, backgroundColor: "#FAFBFF" }}>
              <h3 style={{ marginTop: 0, marginBottom: 12, color: "#0E0A3C" }}>Edit Existing Project</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <input
                  placeholder="Project name"
                  value={editProjectName}
                  onChange={(event) => setEditProjectName(event.target.value)}
                  style={{ padding: 9, borderRadius: 8, border: "1px solid #D8DEEC" }}
                />
                <select value={updatingStatus} onChange={(event) => setUpdatingStatus(event.target.value as ProjectStatus)} style={{ padding: 9, borderRadius: 8, border: "1px solid #D8DEEC" }}>
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <textarea
                placeholder="Project description"
                value={editProjectDesc}
                onChange={(event) => setEditProjectDesc(event.target.value)}
                style={{ width: "100%", minHeight: 90, marginBottom: 10, padding: 9, borderRadius: 8, border: "1px solid #D8DEEC", boxSizing: "border-box", fontFamily: "inherit" }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <input
                  type="date"
                  value={editProjectStartDate}
                  onChange={(event) => setEditProjectStartDate(event.target.value)}
                  style={{ padding: 9, borderRadius: 8, border: "1px solid #D8DEEC" }}
                />
                <input
                  type="date"
                  value={editProjectEndDate}
                  onChange={(event) => setEditProjectEndDate(event.target.value)}
                  style={{ padding: 9, borderRadius: 8, border: "1px solid #D8DEEC" }}
                />
              </div>

              <input
                placeholder="Team members (comma-separated emails)"
                value={editProjectTeamMembers}
                onChange={(event) => setEditProjectTeamMembers(event.target.value)}
                style={{ width: "100%", marginBottom: 10, padding: 9, borderRadius: 8, border: "1px solid #D8DEEC", boxSizing: "border-box" }}
              />

              <button
                type="button"
                onClick={handleEditProject}
                disabled={savingProjectEdits}
                style={{ border: "none", borderRadius: 8, backgroundColor: "#FF7A00", color: "white", padding: "9px 14px", cursor: savingProjectEdits ? "not-allowed" : "pointer", fontWeight: 700, opacity: savingProjectEdits ? 0.7 : 1 }}
              >
                {savingProjectEdits ? "Saving..." : "Save Project Changes"}
              </button>
            </div>
          )}

          {activeTab === "overview" && (
            <ProjectOverviewTab workspace={workspace} loading={loadingWorkspace} onRefresh={() => selectedProjectId && fetchWorkspace(selectedProjectId)} />
          )}

          {activeTab === "tasks" && (
            <ProjectTasksTab
              loading={loadingTasks}
              canCreate={workspace?.user_project_role !== "viewer"}
              tasksView={tasksView}
              listItems={taskList}
              kanbanItems={taskKanban}
              filters={taskFilters}
              members={workspaceMembers}
              stages={stages}
              onViewChange={setTasksView}
              onFilterChange={handleTaskFilterChange}
              onRefresh={() => selectedProjectId && fetchTasks(selectedProjectId, tasksView, taskFilters)}
              onCreateTask={handleCreateTask}
            />
          )}

          {activeTab === "roadmap" && (
            <ProjectRoadmapTab
              roadmap={roadmap}
              loading={loadingRoadmap}
              canEdit={canManageProject}
              onRefresh={() => selectedProjectId && fetchRoadmap(selectedProjectId)}
              onAddStage={handleAddStage}
              onAddMilestone={handleAddMilestone}
              onUpdateMilestone={handleUpdateMilestone}
            />
          )}

          {activeTab === "docs" && (
            <ProjectDocsTab
              docs={docs}
              loading={loadingDocs}
              canEdit={canEditDocs}
              onRefresh={() => selectedProjectId && fetchDocs(selectedProjectId)}
              onCreateDoc={handleCreateDoc}
              onUpdateDoc={handleUpdateDoc}
            />
          )}

          {activeTab === "repository" && (
            <ProjectRepositoryTab
              repository={repository}
              loading={loadingRepository}
              canEdit={canManageProject}
              onRefresh={() => selectedProjectId && fetchRepository(selectedProjectId)}
              onSave={handleSaveRepository}
            />
          )}
              </div>
            ) : (
              <div style={{ backgroundColor: "white", borderRadius: 12, border: "1px solid #ECEEF5", boxShadow: "0 6px 20px rgba(14,10,60,0.06)", padding: 24, color: "#6B7280" }}>
                Choose a project from the sidebar to view its workspace.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ backgroundColor: "white", padding: 24, borderRadius: 12, boxShadow: "0 6px 20px rgba(14,10,60,0.06)", border: "1px solid #ECEEF5", marginTop: 16 }}>
          <div style={{ textAlign: "center", padding: 60, color: "#999" }}>
            <p style={{ fontSize: 18, marginBottom: 10 }}> No projects yet</p>
            <p style={{ fontSize: 14 }}>
              {isAdmin
                ? "Create your first project to get started!"
                : "Projects will appear here once created by the Project Manager"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
