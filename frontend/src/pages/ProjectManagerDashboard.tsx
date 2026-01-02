import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";

interface ProjectManagerDashboardProps {
  onNavigateToChat?: () => void;
  onNavigateToKanban?: () => void;
}

interface TaskType {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  estimated_time?: number;
  dependencies: string[];
  assigned_to: string[];
  created_by: string;
  task_date: string;
  created_at: string;
}

interface TeamMemberType {
  email: string;
  user_id: string;
  task_count: number;
}

export default function ProjectManagerDashboard({ onNavigateToChat, onNavigateToKanban }: ProjectManagerDashboardProps) {
  const { user, logout, token } = useContext(AuthContext);
  const [projectId, setProjectId] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMemberType[]>([]);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [memberTasksByDate, setMemberTasksByDate] = useState<Record<string, TaskType[]>>({});
  const [loading, setLoading] = useState(false);
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [showOnlyToday, setShowOnlyToday] = useState(true);

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const fetchTeamMembers = async (pId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/reports/team-members/${pId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamMembers(response.data);
      setProjectLoaded(true);
      setMemberTasksByDate({});
      setSelectedMember(null);
    } catch (err) {
      alert("Failed to fetch team members");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberTasks = async (pId: string, memberEmail: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/reports/tasks/${pId}/by-member/${memberEmail}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMemberTasksByDate(response.data);
      setSelectedMember(memberEmail);
    } catch (err) {
      alert("Failed to fetch member tasks");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewProject = async () => {
    if (!projectId) {
      alert("Please enter a Project ID");
      return;
    }
    await fetchTeamMembers(projectId);
  };

  const handleSelectMember = (memberEmail: string) => {
    fetchMemberTasks(projectId, memberEmail);
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

  return (
    <div style={{ padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <div>
          <h1>Project Manager Dashboard</h1>
          <div style={{ backgroundColor: "#f0f0f0", padding: 20, borderRadius: 8 }}>
            <h2>Account Information</h2>
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Role:</strong> {user?.role}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {onNavigateToKanban && (
            <button
              onClick={onNavigateToKanban}
              style={{ padding: "10px 20px", backgroundColor: "#6f42c1", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
            >
              📊 Kanban Board
            </button>
          )}
          {onNavigateToChat && (
            <button
              onClick={onNavigateToChat}
              style={{ padding: "10px 20px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
            >
              💬 Open Chat
            </button>
          )}
          <button
            onClick={logout}
            style={{ padding: "10px 20px", backgroundColor: "#ff6b6b", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 30 }}>
        <h2>Project Tracking</h2>
        <div style={{ border: "1px solid #ddd", padding: 20, borderRadius: 8, marginBottom: 20 }}>
          <div style={{ marginBottom: 15 }}>
            <label htmlFor="projectId" style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>
              Project ID:
            </label>
            <input
              id="projectId"
              type="text"
              placeholder="Enter Project ID to view team members"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 4, border: "1px solid #ddd", marginBottom: 10 }}
            />
          </div>

          <button
            onClick={handleViewProject}
            disabled={loading}
            style={{ padding: 10, backgroundColor: "#007bff", color: "white", border: "none", borderRadius: 4, cursor: "pointer", width: "100%" }}
          >
            {loading ? "Loading..." : "View Team Members"}
          </button>
        </div>

        {/* Team Members List */}
        {projectLoaded && teamMembers.length > 0 && (
          <div style={{ marginBottom: 30 }}>
            <h3>👥 Team Members ({teamMembers.length})</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 15 }}>
              {teamMembers.map((member) => (
                <div
                  key={member.email}
                  onClick={() => handleSelectMember(member.email)}
                  style={{
                    padding: 15,
                    border: selectedMember === member.email ? "3px solid #007bff" : "1px solid #ddd",
                    borderRadius: 8,
                    backgroundColor: selectedMember === member.email ? "#e7f3ff" : "#f9f9f9",
                    cursor: "pointer",
                    boxShadow: selectedMember === member.email ? "0 2px 8px rgba(0, 123, 255, 0.2)" : "none",
                    transition: "all 0.3s ease"
                  }}
                >
                  <p style={{ margin: "0 0 10px 0", fontWeight: "bold", color: "#333" }}>{member.email}</p>
                  <p style={{ margin: 0, color: "#666", fontSize: 12 }}>📊 {member.task_count} task{member.task_count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Member Tasks by Date */}
        {selectedMember && Object.keys(memberTasksByDate).length > 0 && (
          <div style={{ marginBottom: 30 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
              <h3 style={{ margin: 0 }}>📋 Tasks for {selectedMember}</h3>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={showOnlyToday}
                  onChange={(e) => setShowOnlyToday(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ fontSize: 14, fontWeight: "bold" }}>Show only today</span>
              </label>
            </div>
            {Object.entries(memberTasksByDate)
              .filter(([date]) => !showOnlyToday || date === getTodayDate())
              .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
              .map(([date, tasks]: [string, TaskType[]]) => {
                const isToday = date === getTodayDate();
                return (
                  <div key={date} style={{ marginBottom: 25 }}>
                    <div style={{
                      backgroundColor: isToday ? "#d4edda" : "#f0f0f0",
                      padding: "12px 15px",
                      borderRadius: 6,
                      marginBottom: 12,
                      borderLeft: isToday ? "5px solid #28a745" : "5px solid #ddd",
                      fontWeight: "bold",
                      color: isToday ? "#155724" : "#666"
                    }}>
                      {isToday ? "📅 Today - " : "📅 "}{new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </div>
                    <div style={{ paddingLeft: 15 }}>
                      {tasks.map((task: TaskType) => (
                        <div
                          key={task.id}
                          style={{
                            padding: 15,
                            backgroundColor: "white",
                            marginBottom: 12,
                            borderLeft: `5px solid ${getPriorityColor(task.priority)}`,
                            borderRadius: 4,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                            <h5 style={{ margin: 0, flex: 1 }}>{task.title}</h5>
                            <span
                              style={{
                                backgroundColor: getStatusColor(task.status),
                                color: "white",
                                padding: "4px 12px",
                                borderRadius: 20,
                                fontSize: 11,
                                whiteSpace: "nowrap",
                                marginLeft: 10,
                                fontWeight: "bold"
                              }}
                            >
                              {task.status}
                            </span>
                          </div>
                          <p style={{ margin: "8px 0", color: "#555", fontSize: 14 }}>{task.description}</p>
                          <div style={{ display: "flex", gap: 20, fontSize: 12, color: "#999", flexWrap: "wrap" }}>
                            <span>
                              <strong>Priority:</strong>{" "}
                              <span style={{ color: getPriorityColor(task.priority), fontWeight: "bold" }}>
                                {task.priority}
                              </span>
                            </span>
                            {task.estimated_time && (
                              <span>
                                <strong>⏱️ Est. Time:</strong> {task.estimated_time}h
                              </span>
                            )}
                            {task.dependencies && task.dependencies.length > 0 && (
                              <span>
                                <strong>🏷️ Tagged:</strong> {task.dependencies.length} {task.dependencies.length === 1 ? "person" : "people"}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {selectedMember && Object.keys(memberTasksByDate).length === 0 && !loading && (
          <div style={{ padding: 20, backgroundColor: "#e8f4f8", borderRadius: 8, color: "#004085" }}>
            No tasks found for {selectedMember}.
          </div>
        )}

        {projectLoaded && teamMembers.length === 0 && !loading && (
          <div style={{ padding: 20, backgroundColor: "#e8f4f8", borderRadius: 8, color: "#004085" }}>
            No team members found for this project. Team members will appear here once they submit tasks.
          </div>
        )}
      </div>

      <div style={{ marginBottom: 30 }}>
        <h2>Team Management</h2>
        <div style={{ border: "1px solid #ddd", padding: 15, borderRadius: 8 }}>
          <p>Manage your team members and their roles.</p>
          <button style={{ padding: 10, backgroundColor: "#28a745", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
            Add Team Member
          </button>
        </div>
      </div>
    </div>
  );
}
