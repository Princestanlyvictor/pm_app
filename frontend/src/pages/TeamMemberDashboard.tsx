import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";
import TaskDetail from "../components/TaskDetail";
import "./TeamMemberDashboard.css";

interface TeamMemberDashboardProps {
  showSidebar?: boolean;
  initialView?: 'home' | 'dependencies' | 'overall-tasks';
  onNavigateToChat: () => void;
  onNavigateToKanban?: () => void;
  onNavigateToProjects?: () => void;
  onNavigateToHourlyBreakdown?: () => void;
}

interface UserType {
  id: string;
  email: string;
  role: string;
}

interface ProjectType {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
}

interface TaskType {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  task_date: string;
  project_id?: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  estimated_time?: number;
  dependencies: string[];
  resolved_dependencies?: string[];
  created_by: string;
  created_at: string;
}

export default function TeamMemberDashboard({ showSidebar = true, initialView = 'home', onNavigateToChat, onNavigateToKanban, onNavigateToProjects, onNavigateToHourlyBreakdown }: TeamMemberDashboardProps) {
  const { user, logout, token } = useContext(AuthContext);
  const [currentView, setCurrentView] = useState<'home' | 'dependencies' | 'overall-tasks'>(initialView);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showMOMForm, setShowMOMForm] = useState(false);
  const [tasksByDate, setTasksByDate] = useState<Record<string, TaskType[]>>({});
  const [taggedTasks, setTaggedTasks] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [projects, setProjects] = useState<ProjectType[]>([]);
  
  const [taskForm, setTaskForm] = useState({
    project_id: "",
    title: "",
    description: "",
    status: "To Do",
    priority: "Medium",
    task_date: new Date().toISOString().split('T')[0],
    scheduled_start_time: "",
    scheduled_end_time: "",
    estimated_time: "",
    assigned_to: [] as string[],
    dependencies: [] as string[]
  });

  const [momForm, setMOMForm] = useState({
    project_id: "",
    date: new Date().toISOString().split('T')[0],
    content: ""
  });

  const [taskError, setTaskError] = useState("");
  const [momError, setMOMError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string | null>(null);

  useEffect(() => {
    if (token && user?.email) {
      fetchUserTasks();
      fetchAllUsers();
      fetchProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.email]);

  useEffect(() => {
    setCurrentView(initialView);
  }, [initialView]);



  const fetchProjects = async () => {
    try {
      const response = await api.get("/projects", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(response.data);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await api.get("/auth/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllUsers(response.data.filter((u: UserType) => u.email !== user?.email));
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  const fetchUserTasks = async () => {
    try {
      const response = await api.get("/reports/user-tasks", {
        headers: { Authorization: `Bearer ${token}` }
      });

      const tasks: TaskType[] = response.data || [];
      
      // Group tasks by date
      const grouped: Record<string, TaskType[]> = {};
      tasks.forEach((task: TaskType) => {
        const date = task.task_date || "No Date";
        if (!grouped[date]) {
          grouped[date] = [];
        }
        grouped[date].push(task);
      });
      
      // Sort dates in descending order
      const sorted: Record<string, TaskType[]> = {};
      Object.keys(grouped)
        .sort((a, b) => {
          if (a === "No Date") return 1;
          if (b === "No Date") return -1;
          return new Date(b).getTime() - new Date(a).getTime();
        })
        .forEach(date => {
          sorted[date] = grouped[date];
        });
      
      setTasksByDate(sorted);

      const tagged = tasks.filter((task) =>
        (task.dependencies || []).includes(user?.email || "")
      );
      setTaggedTasks(tagged);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
  };

  // Get tasks where current user is tagged as dependency
  const getTaggedTasks = (): TaskType[] => {
    return taggedTasks;
  };

  const handleResolveDependency = async (taskId: string) => {
    try {
      await api.put(`/reports/task/${taskId}/resolve-dependency`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccessMessage("Dependency marked as resolved!");
      fetchUserTasks();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(error.response?.data?.detail || "Failed to resolve dependency");
    }
  };

  const handleTaskSubmit = async () => {
    setTaskError("");
    setSuccessMessage("");
    
    if (!taskForm.project_id || !taskForm.title) {
      setTaskError("Project ID and Title are required");
      return;
    }

    try {
      setLoading(true);
      await api.post("/reports/task", taskForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccessMessage("Task submitted successfully!");
      setTaskForm({
        project_id: "",
        title: "",
        description: "",
        status: "To Do",
        priority: "Medium",
        task_date: new Date().toISOString().split('T')[0],
        scheduled_start_time: "",
        scheduled_end_time: "",
        estimated_time: "",
        assigned_to: [],
        dependencies: []
      });
      setShowTaskForm(false);
      fetchUserTasks();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setTaskError(error.response?.data?.detail || "Failed to submit task");
    } finally {
      setLoading(false);
    }
  };

  const handleMOMSubmit = async () => {
    setMOMError("");
    setSuccessMessage("");
    
    if (!momForm.project_id || !momForm.content) {
      setMOMError("Project ID and Content are required");
      return;
    }

    try {
      setLoading(true);
      await api.post("/reports/mom", momForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccessMessage("MOM submitted successfully!");
      setMOMForm({
        project_id: "",
        date: new Date().toISOString().split('T')[0],
        content: ""
      });
      setShowMOMForm(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setMOMError(error.response?.data?.detail || "Failed to submit MOM");
    } finally {
      setLoading(false);
    }
  };

  const todayKey = new Date().toISOString().split('T')[0];
  const todayTasks = tasksByDate[todayKey] || [];
  const completedTodayCount = todayTasks.filter((task) => task.status === "Done").length;
  const pendingTodayCount = todayTasks.filter((task) => task.status !== "Done").length;
  const plannedTodayHours = todayTasks.reduce((sum, task) => sum + Number(task.estimated_time || 0), 0);
  const todayLabel = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const rowsPerPage = 10;

  const historySummaryRows = Object.entries(tasksByDate)
    .map(([date, tasks]) => {
      const total = tasks.length;
      const completed = tasks.filter((task) => task.status === "Done").length;
      const pending = total - completed;
      const completion = total ? Math.round((completed / total) * 100) : 0;
      return { date, total, completed, pending, completion };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredHistoryRows = historyDateFilter
    ? historySummaryRows.filter((row) => row.date === historyDateFilter)
    : historySummaryRows;

  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistoryRows.length / rowsPerPage));
  const paginatedHistoryRows = filteredHistoryRows.slice((historyPage - 1) * rowsPerPage, historyPage * rowsPerPage);

  const selectedDateTasks = selectedHistoryDate ? tasksByDate[selectedHistoryDate] || [] : [];

  const projectNameById = projects.reduce<Record<string, string>>((acc, project) => {
    acc[project.id] = project.name;
    return acc;
  }, {});

  const resolveProjectName = (task: TaskType) => {
    if (!task.project_id) return "-";
    return projectNameById[task.project_id] || task.project_id;
  };

  const formatTimeRange = (task: TaskType) => {
    if (!task.scheduled_start_time && !task.scheduled_end_time) return "-";
    const start = task.scheduled_start_time || "--:--";
    const end = task.scheduled_end_time || "--:--";
    return `${start} - ${end}`;
  };

  const statusClassName = (status: string) => {
    if (status === "Done") return "tm-status-done";
    if (status === "In Progress") return "tm-status-progress";
    return "tm-status-todo";
  };

  return (
    <div className={`tm-dashboard ${showSidebar ? "" : "tm-no-sidebar"}`}>
      {showSidebar && (
        <aside className="tm-sidebar">
          <div className="tm-brand">PM</div>
          <nav className="tm-nav">
            <button className={`tm-nav-item ${currentView === 'home' ? 'active' : ''}`} onClick={() => setCurrentView('home')}>
              Dashboard
            </button>
            <button className={`tm-nav-item ${currentView === 'dependencies' ? 'active' : ''}`} onClick={() => setCurrentView('dependencies')}>
              Dependencies {getTaggedTasks().length > 0 ? `(${getTaggedTasks().length})` : ''}
            </button>
            <button className={`tm-nav-item ${currentView === 'overall-tasks' ? 'active' : ''}`} onClick={() => setCurrentView('overall-tasks')}>
              Overall Tasks
            </button>
            {onNavigateToKanban && (
              <button className="tm-nav-item" onClick={onNavigateToKanban}>Kanban</button>
            )}
            {onNavigateToProjects && (
              <button className="tm-nav-item" onClick={onNavigateToProjects}>Projects</button>
            )}
            {onNavigateToHourlyBreakdown && (
              <button className="tm-nav-item" onClick={onNavigateToHourlyBreakdown}>Daily Schedule</button>
            )}
            <button className="tm-nav-item" onClick={onNavigateToChat}>Chat</button>
            
          </nav>
        </aside>
      )}

      <main className="tm-main">
        <header className="tm-topbar">
          <div className="tm-userline">
            <span>{user?.email?.split("@")[0] || "Team Member"}</span>
            <span className="tm-sep">/</span>
            <span>Team Member</span>
            <span className="tm-sep">|</span>
            <span>{todayLabel}</span>
          </div>
          <button className="tm-logout" onClick={logout}>LOGOUT</button>
        </header>

        {successMessage && <div className="tm-success">{successMessage}</div>}
        {taskError && <div className="tm-error">{taskError}</div>}
        {momError && <div className="tm-error">{momError}</div>}

        {currentView === 'home' && (
          <>
            <section className="tm-overview">
              <h2>DAILY OVERVIEW</h2>
              <div className="tm-stats-grid">
                <div className="tm-stat-card">
                  <p>TODAY&apos;S TASKS</p>
                  <strong>{todayTasks.length}</strong>
                </div>
                <div className="tm-stat-card">
                  <p>COMPLETED</p>
                  <strong className="ok">{completedTodayCount}</strong>
                </div>
                <div className="tm-stat-card">
                  <p>PENDING</p>
                  <strong className="warn">{pendingTodayCount}</strong>
                </div>
                <div className="tm-stat-card">
                  <p>PLANNED TIME</p>
                  <strong>{plannedTodayHours.toFixed(1)} hrs</strong>
                </div>
              </div>
            </section>

            {showTaskForm && (
              <div className="tm-form-wrap">
                <div style={{ marginBottom: 22 }}>
            <div style={{ color: "#667085", fontSize: 14, marginBottom: 8 }}>Dashboard &gt; Tasks &gt; Create</div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 32, color: "#0f172a" }}>Create Task</h3>
                <p style={{ margin: "4px 0 0", color: "#475467", fontSize: 16 }}>Log your daily stand-up progress</p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setShowTaskForm(false)}
                  style={{ padding: "10px 16px", backgroundColor: "#f8fafc", color: "#475467", border: "1px solid #d0d5dd", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleTaskSubmit}
                  disabled={loading}
                  style={{ padding: "10px 16px", backgroundColor: "#2f6fed", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}
                >
                  {loading ? "Creating..." : "Create Task"}
                </button>
              </div>
            </div>

            <div style={{ border: "1px solid #d0d5dd", borderRadius: 12, backgroundColor: "#ffffff", padding: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 22 }}>
                <div>
                  <h4 style={{ marginTop: 0, marginBottom: 14, color: "#0f172a", fontSize: 26 }}>Task Details</h4>

                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#344054" }}>Project</label>
                  <select
                    value={taskForm.project_id}
                    onChange={(e) => setTaskForm({ ...taskForm, project_id: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", marginBottom: 12, borderRadius: 8, border: "1px solid #d0d5dd" }}
                  >
                    <option value="">- Select Project -</option>
                    {projects.length > 0 ? (
                      projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))
                    ) : (
                      <option disabled>No projects available</option>
                    )}
                  </select>

                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#344054" }}>Task Title <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    type="text"
                    placeholder="Title"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", marginBottom: 12, borderRadius: 8, border: "1px solid #d0d5dd", boxSizing: "border-box" }}
                  />

                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#344054" }}>Description</label>
                  <textarea
                    placeholder="e.g. API integration for payment module"
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", marginBottom: 12, borderRadius: 8, border: "1px solid #d0d5dd", minHeight: 110, boxSizing: "border-box", resize: "vertical" }}
                  />


                </div>

                <div style={{ borderLeft: "1px solid #eaecf0", paddingLeft: 20 }}>
                  <h4 style={{ marginTop: 0, marginBottom: 14, color: "#0f172a", fontSize: 22 }}>Time &amp; Effort</h4>

                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#344054" }}>Date</label>
                  <input
                    type="date"
                    value={taskForm.task_date}
                    onChange={(e) => setTaskForm({ ...taskForm, task_date: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", marginBottom: 12, borderRadius: 8, border: "1px solid #d0d5dd" }}
                  />

                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#344054" }}>Start Time</label>
                  <input
                    type="time"
                    value={taskForm.scheduled_start_time}
                    onChange={(e) => setTaskForm({ ...taskForm, scheduled_start_time: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", marginBottom: 12, borderRadius: 8, border: "1px solid #d0d5dd" }}
                  />

                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#344054" }}>End Time</label>
                  <input
                    type="time"
                    value={taskForm.scheduled_end_time}
                    onChange={(e) => setTaskForm({ ...taskForm, scheduled_end_time: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", marginBottom: 12, borderRadius: 8, border: "1px solid #d0d5dd" }}
                  />

                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#344054" }}>Estimated Time (hours)</label>
                  <input
                    type="number"
                    placeholder="Estimated automatically"
                    value={taskForm.estimated_time}
                    onChange={(e) => setTaskForm({ ...taskForm, estimated_time: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", marginBottom: 12, borderRadius: 8, border: "1px solid #d0d5dd" }}
                  />
                </div>

                <div style={{ borderLeft: "1px solid #eaecf0", paddingLeft: 20 }}>
                  <h4 style={{ marginTop: 0, marginBottom: 14, color: "#0f172a", fontSize: 22 }}>Task Properties</h4>

                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#344054" }}>Status</label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", marginBottom: 12, borderRadius: 8, border: "1px solid #d0d5dd" }}
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Done">Done</option>
                  </select>

                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#344054" }}>Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", marginBottom: 16, borderRadius: 8, border: "1px solid #d0d5dd" }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>

                  <h4 style={{ marginTop: 8, marginBottom: 10, color: "#0f172a", fontSize: 22 }}>Team Assignment</h4>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#344054" }}>Assign To <span style={{ color: "#ef4444" }}>*</span></label>
                  <select
                    value={taskForm.assigned_to[0] || ""}
                    onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value ? [e.target.value] : [] })}
                    style={{ width: "100%", padding: "10px 12px", marginBottom: 12, borderRadius: 8, border: "1px solid #d0d5dd" }}
                  >
                    <option value="">Select team member</option>
                    {user?.email && <option value={user.email}>{user.email} (You)</option>}
                    {allUsers.map((member) => (
                      <option key={member.id} value={member.email}>{member.email}</option>
                    ))}
                  </select>
                </div>
              </div>

              {taskError && <p style={{ color: "#dc2626", marginTop: 12, marginBottom: 0 }}>{taskError}</p>}
            </div>
          </div>
              </div>
            )}

            {showMOMForm && (
              <div className="tm-form-wrap" style={{ marginTop: 16 }}>
                <div style={{ border: "1px solid #ddd", padding: 20, borderRadius: 8, marginBottom: 0, backgroundColor: "#f9f9f9" }}>
                  <h3>Submit Minutes of Meeting</h3>
                  <select
                    value={momForm.project_id}
                    onChange={(e) => setMOMForm({ ...momForm, project_id: e.target.value })}
                    style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 4, border: "1px solid #ddd" }}
                  >
                    <option value="">-- Select Project --</option>
                    {projects.length > 0 ? (
                      projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))
                    ) : (
                      <option disabled>No projects available</option>
                    )}
                  </select>
                  <input
                    type="date"
                    value={momForm.date}
                    onChange={(e) => setMOMForm({ ...momForm, date: e.target.value })}
                    style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 4, border: "1px solid #ddd" }}
                  />
                  <textarea
                    placeholder="Meeting notes and points discussed..."
                    value={momForm.content}
                    onChange={(e) => setMOMForm({ ...momForm, content: e.target.value })}
                    style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 4, border: "1px solid #ddd", minHeight: 120 }}
                  />
                  <button
                    onClick={handleMOMSubmit}
                    disabled={loading}
                    style={{ padding: 10, backgroundColor: "#28a745", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
                  >
                    {loading ? "Submitting..." : "Submit MOM"}
                  </button>
                </div>
              </div>
            )}

            <section className="tm-task-list-wrap">
              <h3>Today&apos;s Task List</h3>
              <div>
          {Object.entries(tasksByDate).length === 0 ? (
            <div style={{ border: "1px solid #ddd", padding: 15, borderRadius: 8, backgroundColor: "#f9f9f9" }}>
              <p>No tasks submitted yet.</p>
            </div>
          ) : (
            Object.entries(tasksByDate)
              .filter(([date]) => date === new Date().toISOString().split('T')[0])
              .map(([date, tasks]: [string, TaskType[]]) => (
                <div key={date} style={{ marginBottom: 25 }}>
                  <h4 style={{ color: "#007bff", borderBottom: "2px solid #007bff", paddingBottom: 10 }}>
                     {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h4>
                  <div>
                    {tasks.length === 0 ? (
                      <p style={{ color: "#999", padding: "10px 0" }}>No tasks for today</p>
                    ) : (
                      tasks.map((task: TaskType) => (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          style={{
                            padding: 15,
                            backgroundColor: "white",
                            marginBottom: 10,
                            borderLeft: `4px solid ${getPriorityColor(task.priority)}`,
                            borderRadius: 4,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 3px 8px rgba(0,0,0,0.15)")}
                          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)")}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                            <h5 style={{ margin: 0, flex: 1 }}>{task.title}</h5>
                            <span
                              style={{
                                backgroundColor: getStatusColor(task.status),
                                color: "white",
                                padding: "4px 12px",
                                borderRadius: 20,
                                fontSize: 12,
                                whiteSpace: "nowrap",
                                marginLeft: 10
                              }}
                            >
                              {task.status}
                            </span>
                          </div>
                          <p style={{ margin: "8px 0", color: "#555", fontSize: 14 }}>{task.description}</p>
                          <div style={{ display: "flex", gap: 20, fontSize: 12, color: "#999", flexWrap: "wrap" }}>
                            <span><strong>Est:</strong> {task.estimated_time ? `${task.estimated_time}h` : "N/A"}</span>
                            <span>
                               <strong>Priority:</strong>{" "}
                              <span style={{ color: getPriorityColor(task.priority), fontWeight: "bold" }}>
                                {task.priority}
                              </span>
                            </span>
                            {task.dependencies?.length > 0 && (
                              <span><strong>Tagged:</strong> {task.dependencies.length} {task.dependencies.length === 1 ? "person" : "people"}</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))
          )}
              </div>
            </section>
          </>
        )}

      {currentView === 'overall-tasks' && (
        <section className="tm-secondary-view">
          <h2 style={{ marginBottom: 16, color: "#333" }}>Overall Tasks</h2>

          {!selectedHistoryDate ? (
            <>
              <div className="tm-history-toolbar">
                <label htmlFor="history-date-filter">Find by date</label>
                <input
                  id="history-date-filter"
                  type="date"
                  value={historyDateFilter}
                  onChange={(e) => {
                    setHistoryDateFilter(e.target.value);
                    setHistoryPage(1);
                  }}
                />
                <button
                  type="button"
                  className="tm-ghost-btn"
                  onClick={() => {
                    setHistoryDateFilter("");
                    setHistoryPage(1);
                  }}
                >
                  Clear
                </button>
              </div>

              <div className="tm-table-wrap">
                <table className="tm-history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Total Tasks</th>
                      <th>Completed Tasks</th>
                      <th>Pending Tasks</th>
                      <th>Completion %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHistoryRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="tm-empty-cell">No tasks available for this date</td>
                      </tr>
                    ) : (
                      paginatedHistoryRows.map((row) => (
                        <tr
                          key={row.date}
                          className="tm-clickable-row"
                          onClick={() => setSelectedHistoryDate(row.date)}
                        >
                          <td>
                            {row.date}
                            {row.date === todayKey ? " (Today)" : ""}
                          </td>
                          <td>{row.total}</td>
                          <td>{row.completed}</td>
                          <td>{row.pending}</td>
                          <td>{row.completion}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="tm-pagination-row">
                <button
                  className="tm-ghost-btn"
                  type="button"
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span>
                  Page {historyPage} of {totalHistoryPages}
                </span>
                <button
                  className="tm-ghost-btn"
                  type="button"
                  disabled={historyPage >= totalHistoryPages}
                  onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="tm-breadcrumb-row">
                <button className="tm-ghost-btn" type="button" onClick={() => setSelectedHistoryDate(null)}>
                  Overall Tasks
                </button>
                <span>&gt;</span>
                <span>{selectedHistoryDate}</span>
              </div>

              <div className="tm-table-wrap">
                <table className="tm-history-table tm-detail-table">
                  <thead>
                    <tr>
                      <th>Member Name</th>
                      <th>Task Title</th>
                      <th>Project</th>
                      <th>Description</th>
                      <th>Time (Start-End)</th>
                      <th>Estimated Time</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Blockers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDateTasks.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="tm-empty-cell">No tasks available for this date</td>
                      </tr>
                    ) : (
                      selectedDateTasks.map((task) => (
                        <tr key={task.id}>
                          <td>{user?.email?.split("@")[0] || "Team Member"}</td>
                          <td title={task.title} className="tm-truncate-cell">{task.title}</td>
                          <td title={resolveProjectName(task)} className="tm-truncate-cell">{resolveProjectName(task)}</td>
                          <td title={task.description || "-"} className="tm-truncate-cell">{task.description || "-"}</td>
                          <td>{formatTimeRange(task)}</td>
                          <td>{task.estimated_time ? `${task.estimated_time}h` : "-"}</td>
                          <td>
                            <span className={`tm-status-pill ${statusClassName(task.status)}`}>{task.status}</span>
                          </td>
                          <td>{task.priority}</td>
                          <td title={task.dependencies?.length ? task.dependencies.join(", ") : "-"} className="tm-truncate-cell">
                            {task.dependencies?.length ? task.dependencies.join(", ") : "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {/* Combined Dependencies View */}
      {currentView === 'dependencies' && (
        <div className="tm-secondary-view">
          <>
            <h1 style={{ marginBottom: 20 }}> Dependencies - Tasks You&apos;re Tagged In</h1>
              
            {getTaggedTasks().length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, backgroundColor: "#f9f9f9", borderRadius: 8 }}>
                <p style={{ fontSize: 18, color: "#999", margin: 0 }}> No tasks requiring your attention</p>
                <p style={{ fontSize: 14, color: "#999", marginTop: 10 }}>You&apos;ll see tasks here when someone tags you</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 20, padding: 15, backgroundColor: "#fff3cd", border: "2px solid #ffc107", borderRadius: 8 }}>
                  <h3 style={{ marginTop: 0, color: "#856404" }}>
                    You have been tagged in {getTaggedTasks().length} task{getTaggedTasks().length !== 1 ? 's' : ''}
                  </h3>
                  <p style={{ color: "#856404", margin: 0, fontSize: 14 }}>
                    These tasks require your attention. Click on any task to view details.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 20 }}>
                  {getTaggedTasks().map((task: TaskType) => (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      style={{
                        padding: 20,
                        backgroundColor: "white",
                        borderLeft: `5px solid ${getPriorityColor(task.priority)}`,
                        borderRadius: 8,
                        cursor: "pointer",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        transition: "all 0.3s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "#333" }}>{task.title}</h3>
                      <p style={{ margin: "0 0 15px 0", color: "#666", fontSize: 14, lineHeight: 1.5 }}>
                        {task.description || "No description provided"}
                      </p>
                      
                      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                        <span style={{
                          backgroundColor: getPriorityColor(task.priority),
                          color: "white",
                          padding: "4px 12px",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: "bold"
                        }}>
                          {task.priority} Priority
                        </span>
                        <span style={{
                          backgroundColor: getStatusColor(task.status),
                          color: "white",
                          padding: "4px 12px",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: "bold"
                        }}>
                          {task.status}
                        </span>
                      </div>

                      <div style={{ fontSize: 13, color: "#666", borderTop: "1px solid #eee", paddingTop: 12 }}>
                          <div style={{ marginBottom: 6 }}>
                            <strong>Created by:</strong> {task.created_by}
                          </div>
                          <div style={{ marginBottom: 6 }}>
                            <strong>Due Date:</strong> {new Date(task.task_date).toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </div>
                          {task.estimated_time && (
                            <div>
                              <strong>Estimated Time:</strong> {task.estimated_time} hours
                            </div>
                          )}
                      </div>

                        {/* Resolve Button */}
                      {task.resolved_dependencies?.includes(user?.email || "") ? (
                        <div style={{
                          marginTop: 12,
                          padding: "8px 12px",
                          backgroundColor: "#d4edda",
                          color: "#155724",
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: "bold",
                          textAlign: "center"
                        }}>
                           You&apos;ve marked this as resolved
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolveDependency(task.id);
                          }}
                          style={{
                            marginTop: 12,
                            width: "100%",
                            padding: "10px",
                            backgroundColor: "#28a745",
                            color: "white",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 14,
                            fontWeight: "bold",
                            transition: "background-color 0.2s"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#218838"}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#28a745"}
                        >
                           Mark as Resolved
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <h2 style={{ marginTop: 30, marginBottom: 12, color: "#333" }}>Dependency Status</h2>
            <p style={{ color: "#666", marginBottom: 20 }}>
              View resolution status of tasks where you&apos;ve tagged team members
            </p>

            {(() => {
                // Get tasks created by current user that have dependencies
                const allTasks = Object.values(tasksByDate).flat();
                const tasksWithDependencies = allTasks.filter(
                  (task: TaskType) => task.dependencies && task.dependencies.length > 0
                );

                if (tasksWithDependencies.length === 0) {
                  return (
                    <div style={{
                      padding: 40,
                      textAlign: "center",
                      backgroundColor: "#f8f9fa",
                      borderRadius: 8,
                      color: "#666"
                    }}>
                      <div style={{ fontSize: 48, marginBottom: 16 }}></div>
                      <div style={{ fontSize: 16 }}>
                        You haven&apos;t created any tasks with dependencies yet
                      </div>
                    </div>
                  );
                }

                return (
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", 
                    gap: 20 
                  }}>
                    {tasksWithDependencies.map((task: TaskType) => {
                      const resolvedCount = task.resolved_dependencies?.length || 0;
                      const totalCount = task.dependencies?.length || 0;
                      const allResolved = resolvedCount === totalCount;

                      return (
                        <div
                          key={task.id}
                          style={{
                            backgroundColor: "white",
                            padding: 20,
                            borderRadius: 8,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                            border: `3px solid ${allResolved ? '#28a745' : '#ffc107'}`,
                            cursor: "pointer"
                          }}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: 12
                          }}>
                            <h3 style={{ 
                              margin: 0, 
                              fontSize: 16, 
                              color: "#333",
                              flex: 1
                            }}>
                              {task.title}
                            </h3>
                            <span style={{
                              padding: "4px 10px",
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: "bold",
                              backgroundColor: allResolved ? "#d4edda" : "#fff3cd",
                              color: allResolved ? "#155724" : "#856404"
                            }}>
                              {resolvedCount}/{totalCount}
                            </span>
                          </div>

                          {task.description && (
                            <p style={{ 
                              margin: "8px 0", 
                              color: "#666", 
                              fontSize: 13,
                              lineHeight: 1.4
                            }}>
                              {task.description.length > 100 
                                ? `${task.description.substring(0, 100)}...` 
                                : task.description
                              }
                            </p>
                          )}

                          <div style={{ 
                            marginTop: 16, 
                            paddingTop: 16, 
                            borderTop: "1px solid #eee" 
                          }}>
                            <div style={{ 
                              fontSize: 12, 
                              fontWeight: "bold", 
                              color: "#666", 
                              marginBottom: 10 
                            }}>
                              Tagged Team Members:
                            </div>
                            {task.dependencies?.map((email: string) => {
                              const isResolved = task.resolved_dependencies?.includes(email);
                              return (
                                <div
                                  key={email}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "8px 12px",
                                    marginBottom: 6,
                                    backgroundColor: isResolved ? "#d4edda" : "#f8f9fa",
                                    borderRadius: 6,
                                    fontSize: 13
                                  }}
                                >
                                  <span style={{
                                    marginRight: 10,
                                    fontSize: 16,
                                    fontWeight: "bold",
                                    color: isResolved ? "#28a745" : "#6c757d"
                                  }}>
                                    {isResolved ? "" : ""}
                                  </span>
                                  <span style={{ 
                                    color: isResolved ? "#155724" : "#666",
                                    flex: 1
                                  }}>
                                    {email}
                                  </span>
                                  {isResolved && (
                                    <span style={{
                                      fontSize: 11,
                                      color: "#155724",
                                      fontWeight: "bold"
                                    }}>
                                      RESOLVED
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {task.task_date && (
                            <div style={{ 
                              marginTop: 12, 
                              fontSize: 12, 
                              color: "#666" 
                            }}>
                              <strong>Date:</strong> {new Date(task.task_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
            })()}
          </>
        </div>
      )}

      </main>

      {selectedTaskId && (
        <TaskDetail
          taskId={selectedTaskId}
          token={token!}
          currentEmail={user?.email || ""}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={fetchUserTasks}
        />
      )}
    </div>
  );
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "High":
      return "#ff6b6b";
    case "Medium":
      return "#ffd93d";
    case "Low":
      return "#6bcf7f";
    default:
      return "#999";
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "Done":
      return "#28a745";
    case "In Progress":
      return "#007bff";
    case "To Do":
      return "#999";
    default:
      return "#999";
  }
};
