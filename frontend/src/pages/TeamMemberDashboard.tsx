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
      fetchTaggedTasks();
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
      
      // Group tasks by date
      const grouped: Record<string, TaskType[]> = {};
      response.data.forEach((task: TaskType) => {
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
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
  };

  const fetchTaggedTasks = async () => {
    try {
      // Fetch all tasks in the system to find ones where user is tagged
      const response = await api.get("/reports/all-tasks", {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Filter for tasks where current user is tagged as dependency
      const tagged = response.data.filter((task: TaskType) =>
        task.dependencies?.includes(user?.email || "")
      );
      
      setTaggedTasks(tagged);
    } catch (err) {
      console.error("Failed to fetch tagged tasks:", err);
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
      fetchTaggedTasks();
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
        dependencies: []
      });
      setShowTaskForm(false);
      fetchUserTasks();
      fetchTaggedTasks();
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

  return (
    <div style={{ padding: 40 }}>
      <div style={{ marginBottom: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1>Team Member Dashboard</h1>
          <div style={{ display: "flex", gap: 10 }}>
            {onNavigateToKanban && (
              <button
                onClick={onNavigateToKanban}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#6f42c1",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 16
                }}
              >
                📊 Kanban Board
              </button>
            )}            <button
              onClick={() => setCurrentView('dependencies')}
              style={{
                padding: "10px 20px",
                backgroundColor: currentView === 'dependencies' ? "#e67e22" : "#f39c12",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 16,
                position: "relative",
                fontWeight: currentView === 'dependencies' ? "bold" : "normal"
              }}
            >
              🔔 Dependencies
              {getTaggedTasks().length > 0 && (
                <span style={{
                  position: "absolute",
                  right: 8,
                  top: 8,
                  backgroundColor: "#ff6b6b",
                  color: "white",
                  borderRadius: "50%",
                  width: 20,
                  height: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: "bold"
                }}>
                  {getTaggedTasks().length}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentView('dependency-status')}
              style={{
                padding: "10px 20px",
                marginBottom: 10,
                backgroundColor: currentView === 'dependency-status' ? "#4a90e2" : "white",
                color: currentView === 'dependency-status' ? "white" : "#666",
                border: "none",
                borderRadius: 5,
                cursor: "pointer",
                fontSize: 16,
                fontWeight: currentView === 'dependency-status' ? "bold" : "normal"
              }}
            >
              📊 Dependency Status
            </button>

            {onNavigateToProjects && (
              <button
                onClick={onNavigateToProjects}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#9b59b6",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 16
                }}
              >
                📁 Projects
              </button>
            )}
            <button
              onClick={() => setCurrentView('home')}
              style={{
                padding: "10px 20px",
                backgroundColor: currentView === 'home' ? "#27ae60" : "#2ecc71",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 16,
                fontWeight: currentView === 'home' ? "bold" : "normal"
              }}
            >
              🏠 Home
            </button>
            {onNavigateToHourlyBreakdown && (
              <button
                onClick={onNavigateToHourlyBreakdown}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#f39c12",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 16
                }}
              >
                � Daily Schedule
              </button>
            )}
            <button
              onClick={onNavigateToChat}
              style={{
                padding: "10px 20px",
                backgroundColor: "#17a2b8",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 16
              }}
            >
              � Open Chat
            </button>
            <button
              onClick={logout}
              style={{
                padding: "10px 20px",
                backgroundColor: "#ff6b6b",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              Logout
            </button>
          </div>
        </div>
        <div style={{ backgroundColor: "#f0f0f0", padding: 20, borderRadius: 8, marginTop: 20 }}>
          <h2>Account Information</h2>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Role:</strong> {user?.role}</p>
        </div>
      </div>

      {/* Home View */}
      {currentView === 'home' && (
        <>
          {successMessage && (
            <div style={{ backgroundColor: "#d4edda", color: "#155724", padding: 15, borderRadius: 4, marginBottom: 20 }}>
              {successMessage}
            </div>
          )}

          <div style={{ marginBottom: 30 }}>
            <h2>📅 Today's Tasks (Daily Stand-up)</h2>
        <button
          onClick={() => setShowTaskForm(!showTaskForm)}
          style={{ padding: 10, backgroundColor: "#007bff", color: "white", border: "none", borderRadius: 4, cursor: "pointer", marginBottom: 15 }}
        >
          {showTaskForm ? "Cancel" : "+ Add Daily Task"}
        </button>

        {showTaskForm && (
          <div style={{ border: "1px solid #ddd", padding: 20, borderRadius: 8, marginBottom: 15, backgroundColor: "#f9f9f9" }}>
            <h3>Submit Daily Stand-up Task</h3>
            <select
              value={taskForm.project_id}
              onChange={(e) => setTaskForm({ ...taskForm, project_id: e.target.value })}
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
              type="text"
              placeholder="Task Title"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 4, border: "1px solid #ddd" }}
            />
            <textarea
              placeholder="Task Description"
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 4, border: "1px solid #ddd", minHeight: 80 }}
            />
            <input
              type="date"
              value={taskForm.task_date}
              onChange={(e) => setTaskForm({ ...taskForm, task_date: e.target.value })}
              style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 4, border: "1px solid #ddd" }}
            />
            <label style={{ display: "block", marginBottom: 5, fontWeight: "bold", fontSize: 14 }}>
              ⏰ Start Time (Optional)
            </label>
            <input
              type="time"
              value={taskForm.scheduled_start_time}
              onChange={(e) => setTaskForm({ ...taskForm, scheduled_start_time: e.target.value })}
              style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 4, border: "1px solid #ddd", fontSize: 14 }}
            />
            <label style={{ display: "block", marginBottom: 5, fontWeight: "bold", fontSize: 14 }}>
              ⏰ End Time (Optional)
            </label>
            <input
              type="time"
              value={taskForm.scheduled_end_time}
              onChange={(e) => setTaskForm({ ...taskForm, scheduled_end_time: e.target.value })}
              style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 4, border: "1px solid #ddd", fontSize: 14 }}
            />
            <input
              type="number"
              placeholder="Estimated Time (hours)"
              value={taskForm.estimated_time}
              onChange={(e) => setTaskForm({ ...taskForm, estimated_time: e.target.value })}
              style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 4, border: "1px solid #ddd" }}
            />
            <select
              value={taskForm.status}
              onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
              style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 4, border: "1px solid #ddd" }}
            >
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
            </select>
            <select
              value={taskForm.priority}
              onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
              style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 4, border: "1px solid #ddd" }}
            >
              <option value="Low">Low Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="High">High Priority</option>
            </select>

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
                🏷️ Tag Team Members
              </label>
              <p style={{ marginTop: 0, marginBottom: 10, color: "#666", fontSize: 12 }}>
                Select team members to notify about this task
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto", border: "1px solid #ddd", padding: 10, borderRadius: 4, backgroundColor: "#fafafa" }}>
                {allUsers.length === 0 ? (
                  <p style={{ color: "#999", margin: 0 }}>No other team members available</p>
                ) : (
                  allUsers.map((member) => (
                    <label key={member.id} style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={taskForm.dependencies.includes(member.email)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTaskForm({ ...taskForm, dependencies: [...taskForm.dependencies, member.email] });
                          } else {
                            setTaskForm({ ...taskForm, dependencies: taskForm.dependencies.filter(email => email !== member.email) });
                          }
                        }}
                        style={{ marginRight: 8 }}
                      />
                      <span style={{ fontSize: 14 }}>
                        {member.email}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {taskError && <p style={{ color: "red", marginBottom: 10 }}>{taskError}</p>}
            <button
              onClick={handleTaskSubmit}
              disabled={loading}
              style={{ padding: 10, backgroundColor: "#28a745", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
            >
              {loading ? "Submitting..." : "Submit Task"}
            </button>
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
        <h2>📝 Minutes of Meeting (MOM)</h2>
        <button
          onClick={() => setShowMOMForm(!showMOMForm)}
          style={{ padding: 10, backgroundColor: "#17a2b8", color: "white", border: "none", borderRadius: 4, cursor: "pointer", marginBottom: 15 }}
        >
          {showMOMForm ? "Cancel" : "+ Submit MOM"}
        </button>

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

      {/* Dependencies View */}
      {currentView === 'dependencies' && (
        <div>
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

          {/* Dependency Status View */}
          {currentView === 'dependency-status' && (
            <>
              <h2 style={{ marginBottom: 20, color: "#333" }}>Dependency Status</h2>
              <p style={{ color: "#666", marginBottom: 20 }}>
                View resolution status of tasks where you've tagged team members
              </p>

              {(() => {
                // Get tasks created by current user that have dependencies
                const tasksWithDependencies = tasks.filter(
                  task => task.dependencies && task.dependencies.length > 0
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
                    {tasksWithDependencies.map((task) => {
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
                            {task.dependencies?.map((email) => {
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

                          {task.due_date && (
                            <div style={{ 
                              marginTop: 12, 
                              fontSize: 12, 
                              color: "#666" 
                            }}>
                              <strong>Due:</strong> {new Date(task.due_date).toLocaleDateString()}
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
