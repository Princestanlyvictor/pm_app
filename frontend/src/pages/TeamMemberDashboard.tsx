import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";
import TaskDetail from "../components/TaskDetail";

interface TeamMemberDashboardProps {
  onNavigateToChat: () => void;
  onNavigateToKanban?: () => void;
}

interface UserType {
  id: string;
  email: string;
  role: string;
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
  created_by: string;
  created_at: string;
}

export default function TeamMemberDashboard({ onNavigateToChat, onNavigateToKanban }: TeamMemberDashboardProps) {
  const { user, logout, token } = useContext(AuthContext);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showMOMForm, setShowMOMForm] = useState(false);
  const [tasksByDate, setTasksByDate] = useState<Record<string, TaskType[]>>({});
  const [loading, setLoading] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  
  const [taskForm, setTaskForm] = useState({
    project_id: "",
    title: "",
    description: "",
    status: "To Do",
    priority: "Medium",
    task_date: new Date().toISOString().split('T')[0],
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.email]);

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

  // Get tasks where current user is tagged as dependency
  const getTaggedTasks = (): TaskType[] => {
    const tagged: TaskType[] = [];
    Object.values(tasksByDate).forEach((tasks: TaskType[]) => {
      tasks.forEach((task: TaskType) => {
        if (task.dependencies?.includes(user?.email || "")) {
          tagged.push(task);
        }
      });
    });
    return tagged;
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
        estimated_time: "",
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
              💬 Open Chat
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

      {successMessage && (
        <div style={{ backgroundColor: "#d4edda", color: "#155724", padding: 15, borderRadius: 4, marginBottom: 20 }}>
          {successMessage}
        </div>
      )}

      {/* Notifications for Tagged Tasks */}
      {getTaggedTasks().length > 0 && (
        <div style={{ marginBottom: 30, padding: 15, backgroundColor: "#fff3cd", border: "2px solid #ffc107", borderRadius: 8 }}>
          <h3 style={{ marginTop: 0, color: "#856404", display: "flex", alignItems: "center", gap: 10 }}>
            🔔 You have been tagged in {getTaggedTasks().length} task{getTaggedTasks().length !== 1 ? 's' : ''}
          </h3>
          <p style={{ color: "#856404", margin: "10px 0", fontSize: 14 }}>
            These tasks depend on your input or work:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {getTaggedTasks().map((task: TaskType) => (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                style={{
                  padding: 12,
                  backgroundColor: "white",
                  borderLeft: `4px solid #ffc107`,
                  borderRadius: 4,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 3px 8px rgba(0,0,0,0.15)")}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)")}
              >
                <h5 style={{ margin: "0 0 8px 0", fontSize: 14 }}>{task.title}</h5>
                <p style={{ margin: "0 0 8px 0", color: "#666", fontSize: 12 }}>{task.description}</p>
                <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#999" }}>
                  <span><strong>By:</strong> {task.created_by}</span>
                  <span><strong>Date:</strong> {new Date(task.task_date).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
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
            <input
              type="text"
              placeholder="Project ID"
              value={taskForm.project_id}
              onChange={(e) => setTaskForm({ ...taskForm, project_id: e.target.value })}
              style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 4, border: "1px solid #ddd" }}
            />
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
                🏷️ Tag Team Members (Dependencies)
              </label>
              <p style={{ marginTop: 0, marginBottom: 10, color: "#666", fontSize: 12 }}>
                Select team members who have dependencies on this task (they will be notified)
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
                            setTaskForm({
                              ...taskForm,
                              dependencies: [...taskForm.dependencies, member.email]
                            });
                          } else {
                            setTaskForm({
                              ...taskForm,
                              dependencies: taskForm.dependencies.filter((d) => d !== member.email)
                            });
                          }
                        }}
                        style={{ marginRight: 10, cursor: "pointer" }}
                      />
                      <span>{member.email}</span>
                    </label>
                  ))
                )}
              </div>
              {taskForm.dependencies.length > 0 && (
                <div style={{ marginTop: 10, padding: 10, backgroundColor: "#e7f3ff", borderRadius: 4, border: "1px solid #b3d9ff" }}>
                  <p style={{ margin: "0 0 8px 0", fontWeight: "bold", color: "#004085" }}>Tagged: {taskForm.dependencies.length}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {taskForm.dependencies.map((email) => (
                      <span
                        key={email}
                        style={{
                          backgroundColor: "#007bff",
                          color: "white",
                          padding: "4px 12px",
                          borderRadius: 20,
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() =>
                            setTaskForm({
                              ...taskForm,
                              dependencies: taskForm.dependencies.filter((d) => d !== email)
                            })
                          }
                          style={{
                            background: "none",
                            border: "none",
                            color: "white",
                            cursor: "pointer",
                            fontSize: 16,
                            padding: 0
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
            <input
              type="text"
              placeholder="Project ID"
              value={momForm.project_id}
              onChange={(e) => setMOMForm({ ...momForm, project_id: e.target.value })}
              style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 4, border: "1px solid #ddd" }}
            />
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
