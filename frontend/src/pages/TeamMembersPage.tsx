import { useContext, useEffect, useState, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";

interface TeamMembersPageProps {
  onNavigateBack: () => void;
}

interface TeamMemberType {
  id: string;
  email: string;
  role: string;
}

interface TaskCountType {
  [email: string]: number;
}

export default function TeamMembersPage({ onNavigateBack }: TeamMembersPageProps) {
  const { user, token } = useContext(AuthContext);
  const [teamMembers, setTeamMembers] = useState<TeamMemberType[]>([]);
  const [taskCounts, setTaskCounts] = useState<TaskCountType>({});
  const [loading, setLoading] = useState(false);

  const fetchTeamMembers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/auth/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const users = (response.data || []) as Array<{ id: string; email: string; role: string }>;
      const members: TeamMemberType[] = users.filter((u) => u.role === "team_member");
      setTeamMembers(members);
      
      // Fetch task counts for each member
      const counts: TaskCountType = {};
      for (const member of members) {
        try {
          const tasksResponse = await api.get(`/reports/tasks/by-member/${member.email}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const tasksData = tasksResponse.data as Record<string, unknown[]> || {};
          const totalTasks = Object.values(tasksData).reduce((sum: number, tasks: unknown[]) => sum + (Array.isArray(tasks) ? tasks.length : 0), 0);
          counts[member.email] = totalTasks;
        } catch {
          counts[member.email] = 0;
        }
      }
      setTaskCounts(counts);
    } catch (err) {
      console.error("Failed to fetch team members", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchTeamMembers();
    }
  }, [token, fetchTeamMembers]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5", padding: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <h1 style={{ margin: 0 }}>👥 Team Members Management</h1>
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

      {/* Team Members List */}
      <div style={{ backgroundColor: "white", padding: 30, borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>All Team Members ({teamMembers.length})</h2>
          <button
            onClick={fetchTeamMembers}
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

        {loading && teamMembers.length === 0 ? (
          <p style={{ color: "#666", textAlign: "center", padding: 40 }}>Loading team members...</p>
        ) : teamMembers.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {teamMembers.map((member) => (
              <div
                key={member.id}
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
                <div style={{ display: "flex", alignItems: "center", marginBottom: 15 }}>
                  <div
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: "50%",
                      backgroundColor: "#007bff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: 20,
                      fontWeight: "bold",
                      marginRight: 15
                    }}
                  >
                    {member.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ margin: "0 0 5px 0", color: "#2c3e50", fontSize: 16 }}>
                      {member.email.split('@')[0]}
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: "#999" }}>
                      {member.email}
                    </p>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #dee2e6", paddingTop: 15 }}>
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "#7f8c8d", fontWeight: "bold" }}>
                      Tasks Assigned
                    </p>
                    <p style={{ margin: 0, fontSize: 20, fontWeight: "bold", color: "#007bff" }}>
                      {taskCounts[member.email] || 0}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: "5px 0", fontSize: 12, color: "#999" }}>
                      <strong>Role:</strong> Team Member
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 60, color: "#999" }}>
            <p style={{ fontSize: 18, marginBottom: 10 }}>👥 No team members yet</p>
            <p style={{ fontSize: 14 }}>
              Team members will appear here once account requests are approved
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
