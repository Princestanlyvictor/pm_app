import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";
import "../styles/TaskManagement.css";

interface TaskManagementProps {
  onNavigateToTeamMemberDashboard?: () => void;
  onNavigateToProjects?: () => void;
  onNavigateToKanban?: () => void;
}

type TaskStatus = "todo" | "in_progress" | "completed";
type TaskPriority = "low" | "medium" | "high" | "critical";
type ShiftType = "08:00" | "09:00";

interface ProjectOption {
  id: string;
  name: string;
  description?: string;
  status?: string;
}

interface ApiTaskItem {
  id: string;
  project_id: string;
  parent_task_id?: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  task_date?: string;
  due_date?: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  assigned_to?: string[];
  estimated_time?: number;
  actual_time?: number;
  is_break?: boolean;
  blockers?: string;
  support_required?: string;
  dependencies_note?: string;
  dependencies?: string[];
}

interface TreeTask {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  task_date?: string;
  due_date?: string;
  estimated_time?: number;
  actual_time?: number;
  is_break?: boolean;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  dependencies_note?: string;
  blockers?: string;
  support_required?: string;
  created_date: string;
}

const TaskManagement: React.FC<TaskManagementProps> = ({
  onNavigateToTeamMemberDashboard,
  onNavigateToProjects,
  onNavigateToKanban,
}) => {
  const { token, user } = useContext(AuthContext);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [tasks, setTasks] = useState<TreeTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedShift, setSelectedShift] = useState<ShiftType>("09:00");
  
  const [newTaskForm, setNewTaskForm] = useState<{
    project_id: string;
    title: string;
    description: string;
    date: string;
    start_time: string;
    end_time: string;
    priority: TaskPriority;
    task_type: "work" | "break";
    dependencies_note: string;
    blockers: string;
    support_required: string;
  }>({
    project_id: "",
    title: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    start_time: "09:00",
    end_time: "10:00",
    priority: "medium",
    task_type: "work",
    dependencies_note: "",
    blockers: "",
    support_required: "",
  });
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const toMinutes = (time: string) => {
    const [hours, minutes] = String(time || "").split(":").map(Number);
    return (hours * 60) + minutes;
  };

  const getDurationHours = (start: string, end: string) => {
    if (!start || !end) return 0;
    const diff = toMinutes(end) - toMinutes(start);
    if (diff <= 0) return 0;
    return Number((diff / 60).toFixed(2));
  };

  const toUiStatus = (apiStatus?: string): TaskStatus => {
    const value = String(apiStatus || "").trim().toLowerCase();
    if (value === "done" || value === "completed") return "completed";
    if (value === "in progress" || value === "in_progress") return "in_progress";
    return "todo";
  };

  const toApiStatus = (status: TaskStatus): string => {
    if (status === "completed") return "Done";
    if (status === "in_progress") return "In Progress";
    return "To Do";
  };

  const toUiPriority = (apiPriority?: string): TaskPriority => {
    const value = String(apiPriority || "").trim().toLowerCase();
    if (value === "critical") return "critical";
    if (value === "high") return "high";
    if (value === "low") return "low";
    return "medium";
  };

  const toApiPriority = (priority: TaskPriority): string => {
    if (priority === "critical") return "Critical";
    if (priority === "high") return "High";
    if (priority === "low") return "Low";
    return "Medium";
  };

  const shiftEnd = selectedShift === "08:00" ? "18:00" : "19:00";

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

      const mapped: TreeTask[] = rawItems
        .filter((item) => !item.parent_task_id)
        .map((item) => ({
          id: item.id,
          project_id: item.project_id,
          title: item.title,
          description: item.description || "",
          status: toUiStatus(item.status),
          priority: toUiPriority(item.priority),
          assignee: item.assigned_to?.[0],
          task_date: item.task_date || item.due_date,
          due_date: item.due_date,
          scheduled_start_time: item.scheduled_start_time,
          scheduled_end_time: item.scheduled_end_time,
          estimated_time: item.estimated_time,
          actual_time: item.actual_time,
          is_break: Boolean(item.is_break),
          dependencies_note: item.dependencies_note || "",
          blockers: item.blockers || "",
          support_required: item.support_required || "",
          created_date: "",
        }));

      setTasks(mapped);
    } catch (error) {
      console.error("Failed to load tasks", error);
      setErrorMessage("Failed to load tasks for the selected project.");
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadProjects();
    }
  }, [token, loadProjects]);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      const firstProject = projects[0];
      setSelectedProjectId(firstProject.id);
      setNewTaskForm((prev) => ({ ...prev, project_id: firstProject.id }));
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      loadTasks(selectedProjectId);
    }
  }, [selectedProjectId, loadTasks]);

  // Filter tasks based on project and status
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const statusMatch = statusFilter === "all" || task.status === statusFilter;
      const dateMatch = !dateFilter || (task.task_date || task.due_date || "") === dateFilter;
      return statusMatch && dateMatch;
    });
  }, [tasks, statusFilter, dateFilter]);

  const plannedHours = useMemo(
    () => filteredTasks.reduce((sum, task) => sum + (!task.is_break ? (Number(task.estimated_time) || 0) : 0), 0),
    [filteredTasks]
  );

  const breakHours = useMemo(
    () => filteredTasks.reduce((sum, task) => sum + (task.is_break ? (Number(task.estimated_time) || 0) : 0), 0),
    [filteredTasks]
  );

  const planningWarning = useMemo(() => {
    if (plannedHours < 8) return "Under-planned";
    if (plannedHours > 8) return "Over-planned";
    return "Valid";
  }, [plannedHours]);

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  const createTask = async () => {
    const isBreakTask = newTaskForm.task_type === "break";
    
    if (!isBreakTask && !newTaskForm.title.trim()) {
      setErrorMessage("Task title is required.");
      return;
    }
    const currentUserEmail = String(user?.email || "").trim().toLowerCase();
    if (!currentUserEmail) {
      setErrorMessage("User session is missing. Please login again.");
      return;
    }
    if (!newTaskForm.project_id) {
      setErrorMessage("Select a project while creating task.");
      return;
    }
    if (!newTaskForm.date) {
      setErrorMessage("Task date is required.");
      return;
    }
    let duration = 0;
    if (!newTaskForm.start_time || !newTaskForm.end_time) {
      setErrorMessage("Start time and end time are required.");
      return;
    }

    duration = getDurationHours(newTaskForm.start_time, newTaskForm.end_time);
    if (duration <= 0) {
      setErrorMessage("End time must be greater than start time.");
      return;
    }

    if (isBreakTask) {
      if (!newTaskForm.start_time || !newTaskForm.end_time) {
        setErrorMessage("Start time and end time are required for break.");
        return;
      }
    }

    const overlapExists = tasks.some((task) => {
        const sameDate = (task.task_date || task.due_date || "") === newTaskForm.date;
        const sameAssignee = String(task.assignee || "").toLowerCase() === currentUserEmail;
        if (!sameDate || !sameAssignee || !task.scheduled_start_time || !task.scheduled_end_time) return false;
        const newStart = toMinutes(newTaskForm.start_time);
        const newEnd = toMinutes(newTaskForm.end_time);
        const existingStart = toMinutes(task.scheduled_start_time);
        const existingEnd = toMinutes(task.scheduled_end_time);
        return Math.max(newStart, existingStart) < Math.min(newEnd, existingEnd);
      });

    if (overlapExists) {
      setErrorMessage("Task time overlaps with an existing task for this assignee.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    try {
      await api.post(
        "/reports/task",
        {
          project_id: newTaskForm.project_id,
          title: isBreakTask ? "Break" : newTaskForm.title,
          description: isBreakTask ? "" : newTaskForm.description,
          status: "To Do",
          priority: isBreakTask ? "low" : toApiPriority(newTaskForm.priority),
          assigned_to: [currentUserEmail],
          task_date: newTaskForm.date,
          due_date: newTaskForm.date,
          scheduled_start_time: newTaskForm.start_time,
          scheduled_end_time: newTaskForm.end_time,
          estimated_time: duration,
          is_break: isBreakTask,
          dependencies_note: isBreakTask ? "" : newTaskForm.dependencies_note,
          blockers: isBreakTask ? "" : newTaskForm.blockers,
          support_required: isBreakTask ? "" : newTaskForm.support_required,
          dependencies: [],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSelectedProjectId(newTaskForm.project_id);
      setNewTaskForm((prev) => ({
        ...prev,
        title: "",
        description: "",
        start_time: selectedShift,
        end_time: selectedShift === "08:00" ? "09:00" : "10:00",
        priority: "medium",
        task_type: "work",
        dependencies_note: "",
        blockers: "",
        support_required: "",
      }));
      setDateFilter(newTaskForm.date);
      setShowNewTaskForm(false);
      await loadTasks(newTaskForm.project_id);
    } catch (error: unknown) {
      const typed = error as { response?: { data?: { detail?: string } } };
      setErrorMessage(typed.response?.data?.detail || "Failed to create task.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    const task = tasks.find((item) => item.id === taskId);
    let actualTime: number | undefined;

    if (newStatus === "completed") {
      const promptValue = window.prompt(
        `Planned time: ${Number(task?.estimated_time || 0)} hours\nHow much time did you actually take? (hours)`
      );
      if (promptValue === null) {
        return;
      }
      const parsed = Number(promptValue);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setErrorMessage("Actual time must be a positive number.");
        return;
      }
      actualTime = Number(parsed.toFixed(2));
    }

    try {
      await api.put(
        `/reports/task/${taskId}`,
        {
          status: toApiStatus(newStatus),
          actual_time: actualTime,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, actual_time: actualTime ?? t.actual_time } : t))
      );
    } catch (error: unknown) {
      const typed = error as { response?: { data?: { detail?: string } } };
      setErrorMessage(typed.response?.data?.detail || "Failed to update task.");
    }
  };

  // ============================================
  // RENDER COMPONENTS
  // ============================================

  return (
    <div className="task-management">
      {/* Header */}
      <div className="tm-header">
        <div className="tm-header-top">
          <h1> Task Management</h1>
          <div className="tm-nav-buttons">
            {onNavigateToTeamMemberDashboard && (
              <button className="nav-btn secondary" onClick={onNavigateToTeamMemberDashboard}>
                Back Back to Dashboard
              </button>
            )}
            {onNavigateToProjects && (
              <button className="nav-btn secondary" onClick={onNavigateToProjects}>
                 Projects
              </button>
            )}
            {onNavigateToKanban && (
              <button className="nav-btn secondary" onClick={onNavigateToKanban}>
                Kanban Board
              </button>
            )}
          </div>
        </div>
      </div>

      <>
        {projectsLoading ? (
          <div className="loading-spinner">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <p>No accessible projects found.</p>
          </div>
        ) : null}

      {/* Error Banner */}
      {errorMessage && <div className="error-banner">{errorMessage}</div>}

      {/* Filters & Actions */}
      <div className="tm-toolbar">
        <div className="tm-filters">
          <select
            className="tm-select"
            value={selectedShift}
            onChange={(e) => {
              const shift = e.target.value as ShiftType;
              setSelectedShift(shift);
              setNewTaskForm((prev) => ({
                ...prev,
                start_time: shift,
                end_time: shift === "08:00" ? "09:00" : "10:00",
              }));
            }}
          >
            <option value="08:00">Shift 1 (08:00 - 18:00)</option>
            <option value="09:00">Shift 2 (09:00 - 19:00)</option>
          </select>
          <input
            className="tm-select"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
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

      <div className="planning-indicator">
        <span>Shift Window: {selectedShift} - {shiftEnd} (10 hours)</span>
        <span>Planned Work Time: {plannedHours.toFixed(2)} / 8 hours</span>
        <span>Break Time: {breakHours.toFixed(2)} / 2 hours</span>
        <span className={`planning-warning ${planningWarning === "Valid" ? "valid" : "warn"}`}>
          {planningWarning}
        </span>
      </div>

      {/* New Task Form */}
      {showNewTaskForm && (
        <div className="tm-new-task-form">
          <h3>Create New Task</h3>
          <div className="form-grid">
            <select
              className="form-input"
              value={newTaskForm.task_type}
              onChange={(e) => setNewTaskForm((prev) => ({ ...prev, task_type: e.target.value as "work" | "break" }))}
            >
              <option value="work">Work</option>
              <option value="break">Break</option>
            </select>

            {newTaskForm.task_type === "break" ? (
              <>
                <input
                  className="form-input"
                  type="time"
                  value={newTaskForm.start_time}
                  onChange={(e) => setNewTaskForm((prev) => ({ ...prev, start_time: e.target.value }))}
                  placeholder="Start Time *"
                />
                <input
                  className="form-input"
                  type="time"
                  value={newTaskForm.end_time}
                  onChange={(e) => setNewTaskForm((prev) => ({ ...prev, end_time: e.target.value }))}
                  placeholder="End Time *"
                />
                <button
                  className="nav-btn primary"
                  onClick={createTask}
                  disabled={submitting}
                >
                  {submitting ? "Creating..." : "Create Break"}
                </button>
              </>
            ) : (
              <>
                <select
                  className="form-input"
                  value={newTaskForm.project_id}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setNewTaskForm((prev) => ({ ...prev, project_id: nextId }));
                    setSelectedProjectId(nextId);
                  }}
                >
                  <option value="">Select Project *</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Task Title *"
                  value={newTaskForm.title}
                  onChange={(e) => setNewTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                />
                <textarea
                  className="form-input"
                  placeholder="Description"
                  value={newTaskForm.description}
                  onChange={(e) => setNewTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                />
                <input
                  className="form-input"
                  type="date"
                  value={newTaskForm.date}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setNewTaskForm((prev) => ({ ...prev, date: nextDate }));
                    setDateFilter(nextDate);
                  }}
                />
                <input
                  className="form-input"
                  type="time"
                  value={newTaskForm.start_time}
                  onChange={(e) => setNewTaskForm((prev) => ({ ...prev, start_time: e.target.value }))}
                  placeholder="Task Start From *"
                />
                <input
                  className="form-input"
                  type="time"
                  value={newTaskForm.end_time}
                  onChange={(e) => setNewTaskForm((prev) => ({ ...prev, end_time: e.target.value }))}
                  placeholder="Task End *"
                />
                <select
                  className="form-input"
                  value={newTaskForm.priority}
                  onChange={(e) => setNewTaskForm((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <input
                  className="form-input"
                  type="text"
                  value="Estimated Time: 0.00 hours"
                  disabled
                />
                <input
                  className="form-input"
                  type="text"
                  placeholder="Dependencies"
                  value={newTaskForm.dependencies_note}
                  onChange={(e) => setNewTaskForm((prev) => ({ ...prev, dependencies_note: e.target.value }))}
                />
                <input
                  className="form-input"
                  type="text"
                  placeholder="Blockers"
                  value={newTaskForm.blockers}
                  onChange={(e) => setNewTaskForm((prev) => ({ ...prev, blockers: e.target.value }))}
                />
                <input
                  className="form-input"
                  type="text"
                  placeholder="Support Required"
                  value={newTaskForm.support_required}
                  onChange={(e) => setNewTaskForm((prev) => ({ ...prev, support_required: e.target.value }))}
                />
                <button
                  className="nav-btn primary"
                  onClick={createTask}
                  disabled={submitting}
                >
                  {submitting ? "Creating..." : "Create Task"}
                </button>
              </>
            )}
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
                  <th>Task Title</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Estimated Time</th>
                  <th>Actual Time</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Dependencies</th>
                  <th>Blockers</th>
                  <th>Support Required</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  return (
                    <React.Fragment key={task.id}>
                      <tr className={`tm-task-row ${task.status}`}>
                        <td>
                          <div className="name-cell">
                            <div className="task-title-text">{task.title}</div>
                            {task.description && <div className="task-description-text">{task.description}</div>}
                          </div>
                        </td>
                        <td>{task.scheduled_start_time || "-"}</td>
                        <td>{task.scheduled_end_time || "-"}</td>
                        <td>{Number(task.estimated_time || 0).toFixed(2)}h</td>
                        <td>{task.actual_time ? `${Number(task.actual_time).toFixed(2)}h` : "-"}</td>
                        <td>{task.is_break ? "Break" : "Work"}</td>
                        <td>
                          <select
                            className="status-select inline"
                            value={task.status}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateTaskStatus(task.id, e.target.value as TaskStatus);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </td>
                        <td className="tm-truncate-cell" title={task.dependencies_note || "-"}>{task.dependencies_note || "-"}</td>
                        <td className="tm-truncate-cell" title={task.blockers || "-"}>{task.blockers || "-"}</td>
                        <td className="tm-truncate-cell" title={task.support_required || "-"}>{task.support_required || "-"}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
    </div>
  );
};

export default TaskManagement;
