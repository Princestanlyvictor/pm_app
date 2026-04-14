import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";
import TaskDetail from "../components/TaskDetail";

interface TeamMemberDashboardProps {
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
  estimated_time?: number;
  dependencies: string[];
  resolved_dependencies?: string[];
  created_by: string;
  created_at: string;
}

export default function TeamMemberDashboard({ onNavigateToChat, onNavigateToKanban, onNavigateToProjects, onNavigateToHourlyBreakdown }: TeamMemberDashboardProps) {
  const { user, logout, token } = useContext(AuthContext);
  const [currentView, setCurrentView] = useState<'home' | 'dependencies' | 'dependency-status'>('home');
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

  useEffect(() => {
    if (token && user?.email) {
      fetchUserTasks();
      fetchAllUsers();
      fetchProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.email]);



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
  const allTasks = Object.values(tasksByDate).flat();
  const todayTasks = tasksByDate[todayKey] || [];
  const completedTodayCount = todayTasks.filter((task) => task.status === "Done").length;
  const inProgressTodayCount = todayTasks.filter((task) => task.status === "In Progress").length;
  const toDoTodayCount = todayTasks.filter((task) => task.status === "To Do").length;
  const openHighPriorityCount = allTasks.filter(
    (task) => (task.priority === "High" || task.priority === "Critical") && task.status !== "Done"
  ).length;
  const recentTasks = [...allTasks]
    .sort((a, b) => {
      const dateA = new Date(a.created_at || a.task_date).getTime();
      const dateB = new Date(b.created_at || b.task_date).getTime();
      return dateB - dateA;
    })
    .slice(0, 5);

  return (
    <div style={{ padding: 40 }}>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div
          style={{
            width: 260,
            backgroundColor: "#f8f9fa",
            border: "1px solid #e9ecef",
            borderRadius: 10,
            padding: 16
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: 16, fontSize: 28 }}>Team Member Dashboard</h1>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {onNavigateToKanban && (
              <button
                onClick={onNavigateToKanban}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  backgroundColor: "#6f42c1",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 16,
                  textAlign: "left"
                }}
              >
                📊 Kanban Board
              </button>
            )}

            <button
              onClick={() => setCurrentView('dependencies')}
              style={{
                width: "100%",
                padding: "10px 14px",
                backgroundColor: currentView === 'dependencies' ? "#e67e22" : "#f39c12",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 16,
                fontWeight: currentView === 'dependencies' ? "bold" : "normal",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <span>🔔 Dependencies</span>
              {getTaggedTasks().length > 0 && (
                <span
                  style={{
                    backgroundColor: "#ff6b6b",
                    color: "white",
                    borderRadius: "50%",
                    width: 22,
                    height: 22,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: "bold"
                  }}
                >
                  {getTaggedTasks().length}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentView('dependency-status')}
              style={{
                width: "100%",
                padding: "10px 14px",
                backgroundColor: currentView === 'dependency-status' ? "#4a90e2" : "#eaf2ff",
                color: currentView === 'dependency-status' ? "white" : "#1f4f94",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 16,
                fontWeight: currentView === 'dependency-status' ? "bold" : "normal",
                textAlign: "left"
              }}
            >
              📊 Dependency Status
            </button>

            {onNavigateToProjects && (
              <button
                onClick={onNavigateToProjects}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  backgroundColor: "#9b59b6",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 16,
                  textAlign: "left"
                }}
              >
                📁 Projects
              </button>
            )}

            <button
              onClick={() => setCurrentView('home')}
              style={{
                width: "100%",
                padding: "10px 14px",
                backgroundColor: currentView === 'home' ? "#27ae60" : "#2ecc71",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 16,
                fontWeight: currentView === 'home' ? "bold" : "normal",
                textAlign: "left"
              }}
            >
              🏠 Home
            </button>

            {onNavigateToHourlyBreakdown && (
              <button
                onClick={onNavigateToHourlyBreakdown}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  backgroundColor: "#f39c12",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 16,
                  textAlign: "left"
                }}
              >
                🕒 Daily Schedule
              </button>
            )}

            <button
              onClick={onNavigateToChat}
              style={{
                width: "100%",
                padding: "10px 14px",
                backgroundColor: "#17a2b8",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 16,
                textAlign: "left"
              }}
            >
              💬 Open Chat
            </button>

            <button
              onClick={logout}
              style={{
                width: "100%",
                padding: "10px 14px",
                backgroundColor: "#ff6b6b",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 16,
                textAlign: "left"
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <div style={{ flex: 1 }}>

      {/* Home View */}
      {currentView === 'home' && (
        <>
          {successMessage && (
            <div style={{ backgroundColor: "#d4edda", color: "#155724", padding: 15, borderRadius: 4, marginBottom: 20 }}>
              {successMessage}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <button
              onClick={() => setShowTaskForm(!showTaskForm)}
              style={{
                padding: "10px 16px",
                backgroundColor: showTaskForm ? "#9ca3af" : "#1f6feb",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              {showTaskForm ? "Hide Task Form" : "+ Add Daily Task"}
            </button>
            <button
              onClick={() => setShowMOMForm(!showMOMForm)}
              style={{
                padding: "10px 16px",
                backgroundColor: showMOMForm ? "#94a3b8" : "#0f9fb8",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              {showMOMForm ? "Hide MOM Form" : "+ Submit MOM"}
            </button>
          </div>

          <div
            style={{
              background: "linear-gradient(125deg, #f4f9ff 0%, #edf7f3 55%, #fff7ec 100%)",
              border: "1px solid #dbe6f2",
              borderRadius: 16,
              padding: 20,
              marginBottom: 22
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, color: "#102a43", fontSize: 30, letterSpacing: 0.2 }}>Team Member Workspace</h2>
                <p style={{ margin: "6px 0 0", color: "#486581", fontSize: 14 }}>
                  Track daily delivery, resolve dependencies faster, and keep momentum visible.
                </p>
              </div>
              <div style={{ padding: "8px 12px", backgroundColor: "#ffffffb3", border: "1px solid #d9e7f2", borderRadius: 999, color: "#334e68", fontSize: 13, fontWeight: 600 }}>
                {user?.email}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
              <div style={{ backgroundColor: "#ffffff", border: "1px solid #e6edf5", borderRadius: 12, padding: 14 }}>
                <div style={{ color: "#627d98", fontSize: 13 }}>Today&apos;s Tasks</div>
                <div style={{ color: "#102a43", fontSize: 28, fontWeight: 700, marginTop: 4 }}>{todayTasks.length}</div>
              </div>
              <div style={{ backgroundColor: "#ffffff", border: "1px solid #e6edf5", borderRadius: 12, padding: 14 }}>
                <div style={{ color: "#627d98", fontSize: 13 }}>In Progress</div>
                <div style={{ color: "#1769aa", fontSize: 28, fontWeight: 700, marginTop: 4 }}>{inProgressTodayCount}</div>
              </div>
              <div style={{ backgroundColor: "#ffffff", border: "1px solid #e6edf5", borderRadius: 12, padding: 14 }}>
                <div style={{ color: "#627d98", fontSize: 13 }}>Completed Today</div>
                <div style={{ color: "#2f855a", fontSize: 28, fontWeight: 700, marginTop: 4 }}>{completedTodayCount}</div>
              </div>
              <div style={{ backgroundColor: "#ffffff", border: "1px solid #e6edf5", borderRadius: 12, padding: 14 }}>
                <div style={{ color: "#627d98", fontSize: 13 }}>High Priority Open</div>
                <div style={{ color: "#b42318", fontSize: 28, fontWeight: 700, marginTop: 4 }}>{openHighPriorityCount}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <div style={{ backgroundColor: "#ffffff", border: "1px solid #e6edf5", borderRadius: 12, padding: 14 }}>
                <h3 style={{ margin: "0 0 10px", color: "#102a43", fontSize: 18 }}>Recent Activity</h3>
                {recentTasks.length === 0 ? (
                  <p style={{ margin: 0, color: "#829ab1", fontSize: 14 }}>No task activity yet. Start by creating your first daily task.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {recentTasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        style={{
                          backgroundColor: "#f8fbff",
                          border: "1px solid #dce9f5",
                          borderRadius: 10,
                          padding: "10px 12px",
                          textAlign: "left",
                          cursor: "pointer"
                        }}
                      >
                        <div style={{ color: "#102a43", fontWeight: 600, fontSize: 14 }}>{task.title}</div>
                        <div style={{ color: "#627d98", fontSize: 12, marginTop: 4 }}>
                          {task.status} • {task.priority} • {new Date(task.task_date).toLocaleDateString()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: "#ffffff", border: "1px solid #e6edf5", borderRadius: 12, padding: 14 }}>
                <h3 style={{ margin: "0 0 10px", color: "#102a43", fontSize: 18 }}>Quick Actions</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    onClick={() => setShowTaskForm(true)}
                    style={{ backgroundColor: "#1f6feb", color: "white", border: "none", borderRadius: 9, padding: "10px 12px", cursor: "pointer", fontWeight: 600, textAlign: "left" }}
                  >
                    + New Daily Task
                  </button>
                  <button
                    onClick={() => setCurrentView('dependencies')}
                    style={{ backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: 9, padding: "10px 12px", cursor: "pointer", fontWeight: 600, textAlign: "left" }}
                  >
                    Review Dependencies ({getTaggedTasks().length})
                  </button>
                  <button
                    onClick={() => setCurrentView('dependency-status')}
                    style={{ backgroundColor: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe", borderRadius: 9, padding: "10px 12px", cursor: "pointer", fontWeight: 600, textAlign: "left" }}
                  >
                    Check Dependency Status
                  </button>
                  <button
                    onClick={() => setShowMOMForm(true)}
                    style={{ backgroundColor: "#ecfdf3", color: "#027a48", border: "1px solid #a6f4c5", borderRadius: 9, padding: "10px 12px", cursor: "pointer", fontWeight: 600, textAlign: "left" }}
                  >
                    Submit MOM Notes
                  </button>
                </div>
                <p style={{ margin: "10px 0 0", fontSize: 12, color: "#829ab1" }}>
                  To-Do today: {toDoTodayCount}
                </p>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 30 }}>
        {showTaskForm && (
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
        )}

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
                    📆 {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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
                            <span>⏱️ <strong>Est:</strong> {task.estimated_time ? `${task.estimated_time}h` : "N/A"}</span>
                            <span>
                              🎯 <strong>Priority:</strong>{" "}
                              <span style={{ color: getPriorityColor(task.priority), fontWeight: "bold" }}>
                                {task.priority}
                              </span>
                            </span>
                            {task.dependencies?.length > 0 && (
                              <span>🏷️ <strong>Tagged:</strong> {task.dependencies.length} {task.dependencies.length === 1 ? "person" : "people"}</span>
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
      </div>

      <div style={{ marginBottom: 30 }}>

        {showMOMForm && (
          <div style={{ border: "1px solid #ddd", padding: 20, borderRadius: 8, marginBottom: 15, backgroundColor: "#f9f9f9" }}>
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
            {momError && <p style={{ color: "red", marginBottom: 10 }}>{momError}</p>}
            <button
              onClick={handleMOMSubmit}
              disabled={loading}
              style={{ padding: 10, backgroundColor: "#28a745", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
            >
              {loading ? "Submitting..." : "Submit MOM"}
            </button>
          </div>
        )}
      </div>
        </>
      )}

      {/* Dependencies & Dependency Status Views */}
      {(currentView === 'dependencies' || currentView === 'dependency-status') && (
        <div>
          {currentView === 'dependencies' && (
            <>
              <h1 style={{ marginBottom: 20 }}>🔔 Dependencies - Tasks You're Tagged In</h1>
              
              {getTaggedTasks().length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, backgroundColor: "#f9f9f9", borderRadius: 8 }}>
                  <p style={{ fontSize: 18, color: "#999", margin: 0 }}>✨ No tasks requiring your attention</p>
                  <p style={{ fontSize: 14, color: "#999", marginTop: 10 }}>You'll see tasks here when someone tags you</p>
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
                            ✓ You've marked this as resolved
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
                            ✓ Mark as Resolved
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Dependency Status View */}
          {currentView === 'dependency-status' && (
            <>
              <h2 style={{ marginBottom: 20, color: "#333" }}>Dependency Status</h2>
              <p style={{ color: "#666", marginBottom: 20 }}>
                View resolution status of tasks where you've tagged team members
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
                      <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
                      <div style={{ fontSize: 16 }}>
                        You haven't created any tasks with dependencies yet
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
                                    {isResolved ? "✓" : "○"}
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
          )}
        </div>
      )}

        </div>
      </div>

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
