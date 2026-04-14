import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";
import TaskDetail from "../components/TaskDetail";

interface KanbanBoardProps {
  onNavigateToChat?: () => void;
  onNavigateBack?: () => void;
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
  project_id: string;
}

const STATUS_COLUMNS = ["To Do", "In Progress", "Done"];

export default function KanbanBoard({ onNavigateToChat, onNavigateBack }: KanbanBoardProps) {
  const { user, logout, token } = useContext(AuthContext);
  const [allTasks, setAllTasks] = useState<TaskType[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Record<string, TaskType[]>>({
    "To Do": [],
    "In Progress": [],
    "Done": []
  });
  const [loading, setLoading] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState("");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [availableProjects, setAvailableProjects] = useState<string[]>([]);

  useEffect(() => {
    if (token && user?.email) {
      fetchTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.email]);

  useEffect(() => {
    filterTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTasks, projectFilter, dateFilter]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      let response;
      const isTeamMember = user?.role === "team_member" || user?.role === "user" || user?.role === "member";
      const isAdmin = user?.role === "admin" || user?.role === "project_manager";

      if (isTeamMember) {
        // Team members see only their own tasks
        response = await api.get("/reports/user-tasks", {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else if (isAdmin) {
        // Admin gets a filtered task feed from backend permissions.
        response = await api.get("/reports/user-tasks", {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      if (response) {
        setAllTasks(response.data || []);

        // Extract unique projects
        const projects = [...new Set((response.data || []).map((t: TaskType) => t.project_id))];
        setAvailableProjects(projects.filter(p => p) as string[]);
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      setAllTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const filterTasks = () => {
    let filtered = [...allTasks];

    // Filter by project
    if (projectFilter) {
      filtered = filtered.filter(t => t.project_id === projectFilter);
    }

    // Filter by date
    if (dateFilter) {
      filtered = filtered.filter(t => t.task_date === dateFilter);
    }

    // Group by status
    const grouped: Record<string, TaskType[]> = {};
    STATUS_COLUMNS.forEach(status => {
      grouped[status] = [];
    });

    filtered.forEach(task => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    setFilteredTasks(grouped);
  };

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

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("taskId", taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    const task = allTasks.find(t => t.id === taskId);

    if (task && task.status !== newStatus) {
      try {
        await api.put(
          `/reports/task/${taskId}`,
          { status: newStatus },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setAllTasks(prev =>
          prev.map(t => (t.id === taskId ? { ...t, status: newStatus } : t))
        );
      } catch (err) {
        console.error("Failed to update task status:", err);
      }
    }
  };

  return (
    <div style={{ padding: 40, minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <div>
          <h1>📊 Task Kanban Board</h1>
          <p style={{ color: "#666", marginTop: -10 }}>Drag and drop tasks to change status</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              style={{
                padding: "10px 20px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              ← Back to Dashboard
            </button>
          )}
          {onNavigateToChat && (
            <button
              onClick={onNavigateToChat}
              style={{
                padding: "10px 20px",
                backgroundColor: "#17a2b8",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              💬 Chat
            </button>
          )}
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

      {/* Filters */}
      <div style={{
        display: "flex",
        gap: 15,
        marginBottom: 30,
        padding: 15,
        backgroundColor: "white",
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}>
        <div>
          <label style={{ display: "block", marginBottom: 5, fontWeight: "bold", fontSize: 12 }}>
            Filter by Date:
          </label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 4,
              border: "1px solid #ddd",
              fontSize: 14
            }}
          />
        </div>

        {availableProjects.length > 0 && (
          <div>
            <label style={{ display: "block", marginBottom: 5, fontWeight: "bold", fontSize: 12 }}>
              Filter by Project:
            </label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 4,
                border: "1px solid #ddd",
                fontSize: 14
              }}
            >
              <option value="">All Projects</option>
              {availableProjects.map(project => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={fetchTasks}
          disabled={loading}
          style={{
            padding: "8px 20px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            alignSelf: "flex-end"
          }}
        >
          {loading ? "Refreshing..." : "🔄 Refresh"}
        </button>
      </div>

      {/* Kanban Board */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
        gap: 20
      }}>
        {STATUS_COLUMNS.map(status => (
          <div
            key={status}
            style={{
              backgroundColor: "white",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              overflow: "hidden"
            }}
          >
            {/* Column Header */}
            <div style={{
              backgroundColor: status === "To Do" ? "#e8e8e8" : status === "In Progress" ? "#fff3cd" : "#d4edda",
              padding: "15px 20px",
              borderBottom: "2px solid #ddd",
              fontWeight: "bold",
              fontSize: 16,
              color: "#333"
            }}>
              {status === "To Do" && "📋"} {status === "In Progress" && "⚙️"} {status === "Done" && "✅"} {status}
              <span style={{ float: "right", fontSize: 14, color: "#666" }}>
                ({filteredTasks[status]?.length || 0})
              </span>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status)}
              style={{
                minHeight: 500,
                padding: "15px",
                backgroundColor: status === "To Do" ? "#fafafa" : status === "In Progress" ? "#fffbf0" : "#f0f8f4"
              }}
            >
              {filteredTasks[status]?.length === 0 ? (
                <div style={{
                  textAlign: "center",
                  color: "#999",
                  padding: "40px 10px"
                }}>
                  No tasks yet. Drag tasks here or create new ones.
                </div>
              ) : (
                (filteredTasks[status] || []).map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onClick={() => setSelectedTaskId(task.id)}
                    style={{
                      backgroundColor: "white",
                      border: `3px solid ${getPriorityColor(task.priority)}`,
                      borderRadius: 6,
                      padding: 12,
                      marginBottom: 12,
                      cursor: "grab",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)")}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)")}
                  >
                    <h4 style={{ margin: "0 0 8px 0", fontSize: 14, color: "#333" }}>
                      {task.title}
                    </h4>
                    <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#666", lineHeight: 1.4 }}>
                      {task.description}
                    </p>

                    <div style={{
                      display: "flex",
                      gap: 10,
                      fontSize: 11,
                      color: "#999",
                      marginBottom: 8,
                      flexWrap: "wrap"
                    }}>
                      <span>📅 {new Date(task.task_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      {task.estimated_time && <span>⏱️ {task.estimated_time}h</span>}
                    </div>

                    {task.dependencies?.length > 0 && (
                      <div style={{
                        backgroundColor: "#e7f3ff",
                        padding: "6px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        color: "#004085",
                        marginBottom: 8,
                        wordBreak: "break-word"
                      }}>
                        {task.dependencies.length} tagged
                      </div>
                    )}

                    <div style={{
                      backgroundColor: getPriorityColor(task.priority),
                      color: "white",
                      padding: "4px 8px",
                      borderRadius: 3,
                      fontSize: 10,
                      fontWeight: "bold",
                      display: "inline-block"
                    }}>
                      {task.priority}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetail
          taskId={selectedTaskId}
          token={token!}
          currentEmail={user?.email || ""}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={fetchTasks}
        />
      )}
    </div>
  );
}
