import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";
import "../styles/TaskManagement.css";

interface TaskManagementProps {
  onNavigateToTeamMemberDashboard?: () => void;
  onNavigateToProjects?: () => void;
}

// ============================================
// NESTED SUBTASK SYSTEM - Data Structures
// ============================================

interface Subtask {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "critical";
  assignee?: string;
  due_date?: string;
  estimated_time?: number;
}

interface ProjectMember {
  email: string;
  role?: string;
  name?: string;
}

interface ProjectOption {
  id: string;
  name: string;
  description?: string;
  status?: string;
}

interface ApiTaskItem {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  due_date?: string;
  assigned_to?: string[];
  estimated_time?: number;
}

interface TreeTask {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "critical";
  assignee?: string;
  due_date?: string;
  estimated_time?: number;
  created_date: string;
  subtasks: Subtask[];
  expanded?: boolean;
  adding_subtask?: boolean;
}

const TaskManagement: React.FC<TaskManagementProps> = ({
  onNavigateToTeamMemberDashboard,
  onNavigateToProjects,
}) => {
  const { token } = useContext(AuthContext);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedProjectName, setSelectedProjectName] = useState<string>("");
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);

  // ============================================
  // NESTED SUBTASK SYSTEM - State
  // ============================================
  const [tasks, setTasks] = useState<TreeTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [newTaskForm, setNewTaskForm] = useState<{
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "critical";
    assignee: string;
  }>({
    title: "",
    description: "",
    priority: "medium",
    assignee: "",
  });
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newSubtaskForm, setNewSubtaskForm] = useState<Record<string, {
    title: string;
    priority: "low" | "medium" | "high" | "critical";
    assignee: string;
    estimated_time: number;
    description: string;
    due_date: string;
  }>>({});
  const [selectedSubtaskDetail, setSelectedSubtaskDetail] = useState<{
    parentTaskId: string;
    parentTaskTitle: string;
    subtask: Subtask;
  } | null>(null);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const calculateTaskProgress = (task: TreeTask): number => {
    if (task.subtasks.length === 0) {
      return task.status === "completed" ? 100 : 0;
    }
    const completed = task.subtasks.filter((st) => st.status === "completed").length;
    return Math.round((completed / task.subtasks.length) * 100);
  };

  const calculateEstimatedHours = (task: TreeTask): number => {
    if (task.subtasks.length > 0) {
      return task.subtasks.reduce((sum, subtask) => sum + (Number(subtask.estimated_time) || 0), 0);
    }
    return Number(task.estimated_time) || 0;
  };

  const getDefaultSubtaskForm = () => ({
    title: "",
    priority: "medium" as const,
    assignee: "",
    estimated_time: 1,
    description: "",
    due_date: "",
  });

  const getMemberDisplayName = (email: string): string => {
    const member = projectMembers.find((m) => m.email === email);
    if (member?.name) return member.name;
    return email.split("@")[0].replace(/[._-]/g, " ");
  };

  const extractMemberName = (member: ProjectMember): string => {
    if (member.name) return member.name;
    const email = member.email || "";
    return email.split("@")[0].replace(/[._-]/g, " ");
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "#ff6b6b";
      case "high":
        return "#ff9c3b";
      case "medium":
        return "#ffd93b";
      case "low":
        return "#6bcf7f";
      default:
        return "#667085";
    }
  };

  const toUiStatus = (apiStatus?: string): Subtask["status"] => {
    const value = String(apiStatus || "").trim().toLowerCase();
    if (value === "done" || value === "completed") return "completed";
    if (value === "in progress" || value === "in_progress") return "in_progress";
    return "todo";
  };

  const toApiStatus = (status: Subtask["status"]): string => {
    if (status === "completed") return "Done";
    if (status === "in_progress") return "In Progress";
    return "To Do";
  };

  const toUiPriority = (apiPriority?: string): Subtask["priority"] => {
    const value = String(apiPriority || "").trim().toLowerCase();
    if (value === "critical") return "critical";
    if (value === "high") return "high";
    if (value === "low") return "low";
    return "medium";
  };

  const toApiPriority = (priority: Subtask["priority"]): string => {
    if (priority === "critical") return "Critical";
    if (priority === "high") return "High";
    if (priority === "low") return "Low";
    return "Medium";
  };

  const getToday = () => new Date().toISOString().slice(0, 10);

  const parseParentMarker = (description?: string) => {
    const source = String(description || "");
    const markerRegex = /^\s*\[\[SUBTASK_OF:([^\]]+)\]\]\s*/i;
    const match = source.match(markerRegex);
    if (!match) {
      return { parentId: "", cleanedDescription: source };
    }
    return {
      parentId: match[1].trim(),
      cleanedDescription: source.replace(markerRegex, "").trim(),
    };
  };

  const withParentMarker = (description: string, parentTaskId: string) => {
    const trimmed = description.trim();
    const marker = `[[SUBTASK_OF:${parentTaskId}]]`;
    return trimmed ? `${marker} ${trimmed}` : marker;
  };

  // ============================================
  // LOAD PROJECTS & MANAGE TASKS
  // ============================================

  const loadProjects = useCallback(async () => {
    if (!token) return;
    setProjectsLoading(true);
    setErrorMessage("");
    try {
      const response = await api.get("/projects", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list: ProjectOption[] = (response.data || []).map((project: ProjectOption) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
      }));
      setProjects(list);
    } catch (error) {
      console.error("Failed to load projects", error);
      setErrorMessage("Failed to load project access list.");
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, [token]);

  const loadTasks = useCallback(async (projectId: string) => {
    if (!token || !projectId) return;
    setTasksLoading(true);
    setErrorMessage("");
    try {
      const response = await api.get(`/projects/${projectId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const rawItems: ApiTaskItem[] = Array.isArray(response.data?.items)
        ? response.data.items
        : [];

      const roots: TreeTask[] = [];
      const rootById: Record<string, TreeTask> = {};
      const pendingSubtasks: Array<{ parentId: string; item: ApiTaskItem }> = [];

      rawItems.forEach((item) => {
        const { parentId, cleanedDescription } = parseParentMarker(item.description);
        if (parentId) {
          pendingSubtasks.push({ parentId, item: { ...item, description: cleanedDescription } });
          return;
        }

        const rootTask: TreeTask = {
          id: item.id,
          project_id: item.project_id,
          title: item.title,
          description: cleanedDescription,
          status: toUiStatus(item.status),
          priority: toUiPriority(item.priority),
          assignee: item.assigned_to?.[0],
          due_date: item.due_date,
          estimated_time: item.estimated_time,
          created_date: "",
          subtasks: [],
          expanded: false,
          adding_subtask: false,
        };
        roots.push(rootTask);
        rootById[item.id] = rootTask;
      });

      pendingSubtasks.forEach(({ parentId, item }) => {
        const parentTask = rootById[parentId];
        if (!parentTask) {
          return;
        }
        parentTask.subtasks.push({
          id: item.id,
          title: item.title,
          description: item.description,
          status: toUiStatus(item.status),
          priority: toUiPriority(item.priority),
          assignee: item.assigned_to?.[0],
          due_date: item.due_date,
          estimated_time: item.estimated_time,
        });
      });

      setTasks(roots);
    } catch (error) {
      console.error("Failed to load tasks", error);
      setErrorMessage("Failed to load tasks for the selected project.");
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [token]);

  const loadProjectMembers = useCallback(async (projectId: string) => {
    if (!token || !projectId) return;
    try {
      const response = await api.get(`/projects/${projectId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const members: ProjectMember[] = Array.isArray(response.data)
        ? response.data.map((member: ProjectMember) => ({
            email: String(member.email || ""),
            role: member.role,
            name: extractMemberName(member),
          }))
        : [];
      setProjectMembers(members.filter((m) => m.email));
    } catch (error) {
      console.error("Failed to load project members", error);
      setProjectMembers([]);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadProjects();
    }
  }, [token, loadProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      loadTasks(selectedProjectId);
      loadProjectMembers(selectedProjectId);
    }
  }, [selectedProjectId, loadTasks, loadProjectMembers]);

  // Filter tasks based on project and status
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const statusMatch = statusFilter === "all" || task.status === statusFilter;
      return statusMatch;
    });
  }, [tasks, statusFilter]);

  const activeSubtaskParentTask = useMemo(
    () => tasks.find((task) => task.adding_subtask),
    [tasks]
  );

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  const createTask = async () => {
    if (!newTaskForm.title.trim()) {
      setErrorMessage("Task title is required.");
      return;
    }
    if (!newTaskForm.assignee.trim()) {
      setErrorMessage("Task assignee is required.");
      return;
    }
    if (!selectedProjectId) {
      setErrorMessage("Select a project first.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    try {
      await api.post(
        "/reports/task",
        {
          project_id: selectedProjectId,
          title: newTaskForm.title,
          description: newTaskForm.description,
          status: "To Do",
          priority: toApiPriority(newTaskForm.priority),
          assigned_to: [newTaskForm.assignee],
          estimated_time: 0,
          task_date: getToday(),
          due_date: getToday(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNewTaskForm({ title: "", description: "", priority: "medium", assignee: "" });
      setShowNewTaskForm(false);
      await loadTasks(selectedProjectId);
    } catch (error: unknown) {
      const typed = error as { response?: { data?: { detail?: string } } };
      setErrorMessage(typed.response?.data?.detail || "Failed to create task.");
    } finally {
      setSubmitting(false);
    }
  };

  const syncParentTaskFromSubtasks = useCallback(async (parentTaskId: string, subtasks: Subtask[]) => {
    if (!token) return;
    const totalEstimate = subtasks.reduce((sum, subtask) => sum + (Number(subtask.estimated_time) || 0), 0);
    const allClosed = subtasks.length > 0 && subtasks.every((subtask) => subtask.status === "completed");
    await api.put(
      `/reports/task/${parentTaskId}`,
      {
        estimated_time: totalEstimate,
        status: allClosed ? "Done" : "To Do",
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }, [token]);

  const addSubtask = async (parentTaskId: string) => {
    const form = newSubtaskForm[parentTaskId];
    if (!form || !form.title.trim()) {
      setErrorMessage("Subtask title is required.");
      return;
    }
    if (!form.assignee.trim()) {
      setErrorMessage("Subtask assignee is required.");
      return;
    }
    if (!form.estimated_time || form.estimated_time <= 0) {
      setErrorMessage("Subtask estimated time must be greater than 0.");
      return;
    }
    if (!selectedProjectId) {
      setErrorMessage("Select a project first.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    try {
      await api.post(
        "/reports/task",
        {
          project_id: selectedProjectId,
          title: form.title,
          description: withParentMarker(form.description || "", parentTaskId),
          status: "To Do",
          priority: toApiPriority(form.priority),
          assigned_to: [form.assignee],
          estimated_time: Number(form.estimated_time),
          task_date: getToday(),
          due_date: form.due_date || getToday(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const parentTask = tasks.find((task) => task.id === parentTaskId);
      if (parentTask) {
        const updatedSubtasks: Subtask[] = [
          ...parentTask.subtasks,
          {
            id: "temp",
            title: form.title,
            description: form.description,
            priority: form.priority,
            assignee: form.assignee || undefined,
            estimated_time: Number(form.estimated_time),
            status: "todo",
          },
        ];
        await syncParentTaskFromSubtasks(parentTaskId, updatedSubtasks);
      }

      setNewSubtaskForm((prev) => {
        const updated = { ...prev };
        delete updated[parentTaskId];
        return updated;
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === parentTaskId ? { ...t, adding_subtask: false } : t))
      );
      await loadTasks(selectedProjectId);
    } catch (error: unknown) {
      const typed = error as { response?: { data?: { detail?: string } } };
      setErrorMessage(typed.response?.data?.detail || "Failed to add subtask.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateSubtaskStatus = async (parentTaskId: string, subtaskId: string, newStatus: Subtask["status"]) => {
    try {
      await api.put(
        `/reports/task/${subtaskId}`,
        { status: toApiStatus(newStatus) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const parentTask = tasks.find((task) => task.id === parentTaskId);
      const updatedSubtasks = (parentTask?.subtasks || []).map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, status: newStatus } : subtask
      );

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === parentTaskId) {
            const updated = {
              ...t,
              subtasks: updatedSubtasks,
            };
            if (updated.subtasks.length > 0 && updated.subtasks.every((st) => st.status === "completed")) {
              updated.status = "completed";
            } else if (updated.subtasks.length > 0) {
              updated.status = "todo";
            }
            return updated;
          }
          return t;
        })
      );

      await syncParentTaskFromSubtasks(parentTaskId, updatedSubtasks);
    } catch (error: unknown) {
      const typed = error as { response?: { data?: { detail?: string } } };
      setErrorMessage(typed.response?.data?.detail || "Failed to update subtask.");
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: TreeTask["status"]) => {
    const task = tasks.find((item) => item.id === taskId);
    if (
      newStatus === "completed" &&
      task &&
      task.subtasks.length > 0 &&
      !task.subtasks.every((subtask) => subtask.status === "completed")
    ) {
      setErrorMessage("Task can be marked completed only after all subtasks are completed.");
      return;
    }

    try {
      await api.put(
        `/reports/task/${taskId}`,
        { status: toApiStatus(newStatus) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
    } catch (error: unknown) {
      const typed = error as { response?: { data?: { detail?: string } } };
      setErrorMessage(typed.response?.data?.detail || "Failed to update task.");
    }
  };

  // Delete functionality not yet implemented (no DELETE endpoint available)

  const handleSelectProject = (project: ProjectOption) => {
    setSelectedProjectId(project.id);
    setSelectedProjectName(project.name);
    setStatusFilter("all");
    setShowNewTaskForm(false);
    setNewTaskForm({ title: "", description: "", priority: "medium", assignee: "" });
    setNewSubtaskForm({});
    setErrorMessage("");
  };

  const handleBackToProjectSelection = () => {
    setSelectedProjectId("");
    setSelectedProjectName("");
    setTasks([]);
    setProjectMembers([]);
    setShowNewTaskForm(false);
    setNewSubtaskForm({});
    setErrorMessage("");
  };

  const closeSubtaskDetailPanel = () => {
    setTasks((prev) => prev.map((task) => ({ ...task, adding_subtask: false })));
  };

  const closeSubtaskReadPanel = () => {
    setSelectedSubtaskDetail(null);
  };

  // ============================================
  // RENDER COMPONENTS
  // ============================================

  return (
    <div className="task-management">
      {/* Header */}
      <div className="tm-header">
        <div className="tm-header-top">
          <h1>📋 Task Management</h1>
          <div className="tm-nav-buttons">
            {onNavigateToTeamMemberDashboard && (
              <button className="nav-btn secondary" onClick={onNavigateToTeamMemberDashboard}>
                ← Back to Dashboard
              </button>
            )}
            {onNavigateToProjects && (
              <button className="nav-btn secondary" onClick={onNavigateToProjects}>
                📁 Projects
              </button>
            )}
          </div>
        </div>
      </div>

      {!selectedProjectId && (
        <div className="project-selection-panel">
          <div className="project-selection-header">
            <h2>Select Project</h2>
            <p>Choose a project you can access, then create and organize tasks with subtasks.</p>
          </div>

          {projectsLoading ? (
            <div className="loading-spinner">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="empty-state">
              <p>No accessible projects found.</p>
            </div>
          ) : (
            <div className="project-selection-grid">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className="project-selection-card"
                  onClick={() => handleSelectProject(project)}
                >
                  <div className="project-selection-title-row">
                    <h3>{project.name}</h3>
                    <span className="project-selection-status">{project.status || "Active"}</span>
                  </div>
                  <p>{project.description || "No description provided."}</p>
                  <span className="project-selection-action">Open Task Workspace →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedProjectId && (
        <>
          <div className="selected-project-bar">
            <div>
              <span className="selected-project-label">Selected Project</span>
              <strong>{selectedProjectName}</strong>
            </div>
            <button className="nav-btn secondary" onClick={handleBackToProjectSelection}>
              Change Project
            </button>
          </div>

      {/* Error Banner */}
      {errorMessage && <div className="error-banner">{errorMessage}</div>}

      {/* Filters & Actions */}
      <div className="tm-toolbar">
        <div className="tm-filters">
          <select
            className="tm-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <button
          className="nav-btn primary"
          onClick={() => setShowNewTaskForm(!showNewTaskForm)}
        >
          {showNewTaskForm ? "Cancel" : "+ New Task"}
        </button>
      </div>

      {/* New Task Form */}
      {showNewTaskForm && (
        <div className="tm-new-task-form">
          <h3>Create New Task</h3>
          <div className="form-grid">
            <input
              className="form-input"
              type="text"
              placeholder="Task Name"
              value={newTaskForm.title}
              onChange={(e) => setNewTaskForm((prev) => ({ ...prev, title: e.target.value }))}
            />
            <input
              className="form-input"
              type="text"
              placeholder="Task Description"
              value={newTaskForm.description}
              onChange={(e) => setNewTaskForm((prev) => ({ ...prev, description: e.target.value }))}
            />
            <select
              className="form-input"
              value={newTaskForm.assignee}
              onChange={(e) => setNewTaskForm((prev) => ({ ...prev, assignee: e.target.value }))}
            >
              <option value="">Select Member *</option>
              {projectMembers.map((member) => (
                <option key={member.email} value={member.email}>{getMemberDisplayName(member.email)}</option>
              ))}
            </select>
            <select
              className="form-input"
              value={newTaskForm.priority}
              onChange={(e) => setNewTaskForm((prev) => ({ ...prev, priority: e.target.value as "low" | "medium" | "high" | "critical" }))}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <input
              className="form-input"
              type="text"
              value="Estimated Time is auto-calculated from subtasks"
              disabled
            />
            <button
              className="nav-btn primary"
              onClick={createTask}
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create Task"}
            </button>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="tm-content">
        {tasksLoading ? (
          <div className="loading-spinner">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="empty-state">
            <p>No tasks found. Create one to get started!</p>
          </div>
        ) : (
          <div className="tm-table-container">
            <table className="tm-task-table">
              <thead>
                <tr className="tm-table-header">
                  <th style={{ width: "8%" }}></th>
                  <th style={{ width: "12%" }}>Status</th>
                  <th style={{ width: "32%" }}>Name</th>
                  <th style={{ width: "18%" }}>Assignee</th>
                  <th style={{ width: "15%" }}>Due Date</th>
                  <th style={{ width: "10%" }}>Priority</th>
                  <th style={{ width: "10%" }}>ETA (h)</th>
                  <th style={{ width: "5%" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const hasSubtasks = (task.subtasks || []).length > 0;
                  const progress = calculateTaskProgress(task);

                  return (
                    <React.Fragment key={task.id}>
                      {/* Main Task Row */}
                      <tr className={`tm-task-row ${task.status}`} onClick={() => {
                        if (hasSubtasks) {
                          setTasks((prev) =>
                            prev.map((t) => (t.id === task.id ? { ...t, expanded: !t.expanded } : t))
                          );
                        }
                      }}>
                        <td className="expand-col">
                          {hasSubtasks && (
                            <button
                              className="expand-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTasks((prev) =>
                                  prev.map((t) =>
                                    t.id === task.id ? { ...t, expanded: !t.expanded } : t
                                  )
                                );
                              }}
                            >
                              {task.expanded ? "▼" : "▶"}
                            </button>
                          )}
                        </td>
                        <td className="status-col">
                          <select
                            className="status-select"
                            value={task.status}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateTaskStatus(task.id, e.target.value as "todo" | "in_progress" | "completed");
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </td>
                        <td className="name-col">
                          <div className="name-cell">
                            <div>
                              <div className="task-title-text">{task.title}</div>
                              {task.description && <div className="task-description-text">{task.description}</div>}
                              {hasSubtasks && (
                                <div className="subtask-indicator">
                                  {task.subtasks.length} subtask{task.subtasks.length !== 1 ? 's' : ''} • {progress}% complete
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="assignee-col">
                          {task.assignee ? (
                            <div className="assignee-badge">
                              <div className="avatar" title={getMemberDisplayName(task.assignee)}>
                                {getMemberDisplayName(task.assignee).charAt(0).toUpperCase()}
                              </div>
                              <span>{getMemberDisplayName(task.assignee)}</span>
                            </div>
                          ) : (
                            <span className="empty-cell">-</span>
                          )}
                        </td>
                        <td className="due-date-col">
                          {task.due_date ? (
                            <span className="due-date-text">{task.due_date}</span>
                          ) : (
                            <span className="empty-cell">-</span>
                          )}
                        </td>
                        <td className="priority-col">
                          <span className="priority-badge" style={{ backgroundColor: getPriorityColor(task.priority) }}>
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                          </span>
                        </td>
                        <td className="eta-col">
                          <span className="eta-text">{calculateEstimatedHours(task)}h</span>
                        </td>
                        <td className="actions-col">
                          <div className="action-buttons">
                            <button
                              className="action-btn add-subtask"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewSubtaskForm((prev) => ({
                                  ...prev,
                                  [task.id]: prev[task.id] || getDefaultSubtaskForm(),
                                }));
                                setTasks((prev) =>
                                  prev.map((t) =>
                                    t.id === task.id
                                      ? { ...t, adding_subtask: true }
                                      : { ...t, adding_subtask: false }
                                  )
                                );
                              }}
                              title="Add Subtask"
                            >
                              +
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Subtasks (Expanded) */}
                      {task.expanded && hasSubtasks && (
                        <>
                          {task.subtasks.map((subtask) => (
                            <tr
                              key={subtask.id}
                              className="tm-subtask-row"
                              onClick={() =>
                                setSelectedSubtaskDetail({
                                  parentTaskId: task.id,
                                  parentTaskTitle: task.title,
                                  subtask,
                                })
                              }
                            >
                              <td className="expand-col"></td>
                              <td className="status-col">
                                <input
                                  type="checkbox"
                                  checked={subtask.status === "completed"}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    updateSubtaskStatus(task.id, subtask.id, e.target.checked ? "completed" : "todo");
                                  }}
                                  className="subtask-checkbox"
                                  title={subtask.status === "completed" ? "Mark as incomplete" : "Mark as complete"}
                                />
                              </td>
                              <td className="name-col">
                                <div className="subtask-name">
                                  <span
                                    style={{
                                      textDecoration: subtask.status === "completed" ? "line-through" : "none",
                                      opacity: subtask.status === "completed" ? 0.6 : 1,
                                    }}
                                  >
                                    {subtask.title}
                                  </span>
                                  <div className="subtask-open-hint">Click to view details</div>
                                </div>
                              </td>
                              <td className="assignee-col">
                                {subtask.assignee ? (
                                  <div className="assignee-badge">
                                    <div className="avatar" title={getMemberDisplayName(subtask.assignee)}>
                                      {getMemberDisplayName(subtask.assignee).charAt(0).toUpperCase()}
                                    </div>
                                    <span>{getMemberDisplayName(subtask.assignee)}</span>
                                  </div>
                                ) : (
                                  <span className="empty-cell">-</span>
                                )}
                              </td>
                              <td className="due-date-col">
                                {subtask.due_date ? (
                                  <span className="due-date-text">{subtask.due_date}</span>
                                ) : (
                                  <span className="empty-cell">-</span>
                                )}
                              </td>
                              <td className="priority-col">
                                <span className="priority-badge" style={{ backgroundColor: getPriorityColor(subtask.priority) }}>
                                  {subtask.priority.charAt(0).toUpperCase() + subtask.priority.slice(1)}
                                </span>
                              </td>
                              <td className="eta-col">
                                <span className="eta-text">{Number(subtask.estimated_time) || 0}h</span>
                              </td>
                              <td className="actions-col">
                                {/* Delete button - DELETE endpoint not yet available
                                <button
                                  className="action-btn delete"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSubtask(subtask.id);
                                  }}
                                  title="Delete Subtask"
                                >
                                  ✕
                                </button>
                                */}
                              </td>
                            </tr>
                          ))}
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeSubtaskParentTask && (
        <div className="subtask-detail-overlay" role="dialog" aria-modal="true">
          <div className="subtask-detail-page">
            <aside className="subtask-detail-sidebar">
              <h4>Task Tree</h4>
              <div className="subtask-parent-item active">{activeSubtaskParentTask.title}</div>
              <div className="subtask-tree-hint">Creating a subtask under this parent task.</div>
            </aside>

            <section className="subtask-detail-content">
              <div className="subtask-detail-topbar">
                <button className="nav-btn secondary" onClick={closeSubtaskDetailPanel}>
                  ← Back to Task List
                </button>
                <button
                  className="nav-btn primary"
                  onClick={() => addSubtask(activeSubtaskParentTask.id)}
                  disabled={submitting}
                >
                  {submitting ? "Creating..." : "Create Subtask"}
                </button>
              </div>

              <div className="subtask-detail-breadcrumb">
                Subtask of <strong>{activeSubtaskParentTask.title}</strong>
              </div>

              <h2 className="subtask-detail-title">Create Subtask</h2>

              <div className="subtask-detail-summary">
                Add complete details for this subtask. It will update parent progress and estimated time automatically.
              </div>

              <div className="subtask-detail-info-grid">
                <div className="detail-item">
                  <span>Status</span>
                  <strong>To Do</strong>
                </div>
                <div className="detail-item">
                  <span>Parent Task</span>
                  <strong>{activeSubtaskParentTask.title}</strong>
                </div>
                <div className="detail-item">
                  <span>Priority</span>
                  <strong>{(newSubtaskForm[activeSubtaskParentTask.id]?.priority || "medium").toUpperCase()}</strong>
                </div>
                <div className="detail-item">
                  <span>Time Estimate</span>
                  <strong>{newSubtaskForm[activeSubtaskParentTask.id]?.estimated_time || 1}h</strong>
                </div>
              </div>

              <div className="subtask-detail-form">
                <label>
                  Subtask Name *
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Enter subtask name"
                    value={newSubtaskForm[activeSubtaskParentTask.id]?.title || ""}
                    onChange={(e) =>
                      setNewSubtaskForm((prev) => ({
                        ...prev,
                        [activeSubtaskParentTask.id]: {
                          ...(prev[activeSubtaskParentTask.id] || getDefaultSubtaskForm()),
                          title: e.target.value,
                        },
                      }))
                    }
                  />
                </label>

                <label>
                  Description
                  <textarea
                    className="form-input subtask-detail-textarea"
                    placeholder="Describe this subtask"
                    value={newSubtaskForm[activeSubtaskParentTask.id]?.description || ""}
                    onChange={(e) =>
                      setNewSubtaskForm((prev) => ({
                        ...prev,
                        [activeSubtaskParentTask.id]: {
                          ...(prev[activeSubtaskParentTask.id] || getDefaultSubtaskForm()),
                          description: e.target.value,
                        },
                      }))
                    }
                  />
                </label>

                <div className="subtask-detail-form-grid">
                  <label>
                    Assignee *
                    <select
                      className="form-input"
                      value={newSubtaskForm[activeSubtaskParentTask.id]?.assignee || ""}
                      onChange={(e) =>
                        setNewSubtaskForm((prev) => ({
                          ...prev,
                          [activeSubtaskParentTask.id]: {
                            ...(prev[activeSubtaskParentTask.id] || getDefaultSubtaskForm()),
                            assignee: e.target.value,
                          },
                        }))
                      }
                    >
                      <option value="">Select Member *</option>
                      {projectMembers.map((member) => (
                        <option key={member.email} value={member.email}>{getMemberDisplayName(member.email)}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Priority
                    <select
                      className="form-input"
                      value={newSubtaskForm[activeSubtaskParentTask.id]?.priority || "medium"}
                      onChange={(e) =>
                        setNewSubtaskForm((prev) => ({
                          ...prev,
                          [activeSubtaskParentTask.id]: {
                            ...(prev[activeSubtaskParentTask.id] || getDefaultSubtaskForm()),
                            priority: e.target.value as "low" | "medium" | "high" | "critical",
                          },
                        }))
                      }
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>

                  <label>
                    Estimate (hours) *
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      placeholder="1"
                      value={newSubtaskForm[activeSubtaskParentTask.id]?.estimated_time || 1}
                      onChange={(e) =>
                        setNewSubtaskForm((prev) => ({
                          ...prev,
                          [activeSubtaskParentTask.id]: {
                            ...(prev[activeSubtaskParentTask.id] || getDefaultSubtaskForm()),
                            estimated_time: Number(e.target.value) || 0,
                          },
                        }))
                      }
                    />
                  </label>

                  <label>
                    Due Date
                    <input
                      className="form-input"
                      type="date"
                      value={newSubtaskForm[activeSubtaskParentTask.id]?.due_date || ""}
                      onChange={(e) =>
                        setNewSubtaskForm((prev) => ({
                          ...prev,
                          [activeSubtaskParentTask.id]: {
                            ...(prev[activeSubtaskParentTask.id] || getDefaultSubtaskForm()),
                            due_date: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {selectedSubtaskDetail && (
        <div className="subtask-detail-overlay" role="dialog" aria-modal="true">
          <div className="subtask-detail-page">
            <aside className="subtask-detail-sidebar">
              <h4>Task Tree</h4>
              <div className="subtask-parent-item">{selectedSubtaskDetail.parentTaskTitle}</div>
              <div className="subtask-parent-item active" style={{ marginTop: 8 }}>
                {selectedSubtaskDetail.subtask.title}
              </div>
              <div className="subtask-tree-hint">Detailed subtask view from the dropdown list.</div>
            </aside>

            <section className="subtask-detail-content">
              <div className="subtask-detail-topbar">
                <button className="nav-btn secondary" onClick={closeSubtaskReadPanel}>
                  ← Back to Subtasks
                </button>
              </div>

              <div className="subtask-detail-breadcrumb">
                Subtask of <strong>{selectedSubtaskDetail.parentTaskTitle}</strong>
              </div>

              <h2 className="subtask-detail-title">{selectedSubtaskDetail.subtask.title}</h2>

              <div className="subtask-detail-info-grid">
                <div className="detail-item">
                  <span>Status</span>
                  <strong>{selectedSubtaskDetail.subtask.status.replace("_", " ").toUpperCase()}</strong>
                </div>
                <div className="detail-item">
                  <span>Assignee</span>
                  <strong>
                    {selectedSubtaskDetail.subtask.assignee
                      ? getMemberDisplayName(selectedSubtaskDetail.subtask.assignee)
                      : "Unassigned"}
                  </strong>
                </div>
                <div className="detail-item">
                  <span>Priority</span>
                  <strong>{selectedSubtaskDetail.subtask.priority.toUpperCase()}</strong>
                </div>
                <div className="detail-item">
                  <span>Time Estimate</span>
                  <strong>{Number(selectedSubtaskDetail.subtask.estimated_time) || 0}h</strong>
                </div>
                <div className="detail-item">
                  <span>Due Date</span>
                  <strong>{selectedSubtaskDetail.subtask.due_date || "Not set"}</strong>
                </div>
                <div className="detail-item">
                  <span>Parent Task</span>
                  <strong>{selectedSubtaskDetail.parentTaskTitle}</strong>
                </div>
              </div>

              <div className="subtask-readonly-description">
                <h4>Description</h4>
                <p>{selectedSubtaskDetail.subtask.description || "No description provided."}</p>
              </div>
            </section>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default TaskManagement;
