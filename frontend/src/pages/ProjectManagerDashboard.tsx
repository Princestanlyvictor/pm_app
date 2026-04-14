import { useContext, useEffect, useState, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";

interface ProjectManagerDashboardProps {
  onNavigateToChat?: () => void;
  onNavigateToKanban?: () => void;
  onNavigateToProjects?: () => void;
  onNavigateToTeamMembers?: () => void;
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
  id: string;
  email: string;
  role: string;
}

interface AccountRequestType {
  _id: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  requested_by: string;
}

interface TodayTaskBreakdown {
  email: string;
  user_id: string;
  total_tasks: number;
  status_counts: Record<string, number>;
  priority_counts: Record<string, number>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    project_id: string;
  }>;
}

interface DailyPlanMemberRow {
  user_email: string;
  has_plan: boolean;
  planned_minutes: number;
  actual_minutes: number;
  variance_minutes: number;
  over_utilized: boolean;
  under_utilized: boolean;
  completed_blocks: number;
  pending_blocks: number;
  delay_reasons: Array<{ task_title: string; reason: string }>;
}

interface ManagerSummaryPayload {
  date: string;
  members: DailyPlanMemberRow[];
  team_summary: {
    total_team_members: number;
    total_planned_minutes: number;
    total_actual_minutes: number;
    variance_minutes: number;
    completed_blocks: number;
    pending_blocks: number;
    completion_rate_percent: number;
  };
  delay_reasons: Array<{ user_email: string; task_title: string; reason: string }>;
}

interface ManagerMemberTimelinePayload {
  date: string;
  user_email: string;
  plan: {
    id: string;
    available_minutes: number;
    total_planned_minutes: number;
    total_actual_minutes: number;
    status: string;
  } | null;
  timeline: Array<{
    type: "gap" | "work_block";
    from: string;
    to: string;
    task_title?: string;
    sub_task?: string;
    status?: string;
  }>;
  alerts: Array<{ type: string; message: string }>;
}

export default function ProjectManagerDashboard({ onNavigateToChat, onNavigateToKanban, onNavigateToProjects, onNavigateToTeamMembers }: ProjectManagerDashboardProps) {
  const { user, logout, token } = useContext(AuthContext);
  const [teamMembers, setTeamMembers] = useState<TeamMemberType[]>([]);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [memberTasksByDate, setMemberTasksByDate] = useState<Record<string, TaskType[]>>({});
  const [todayBreakdown, setTodayBreakdown] = useState<TodayTaskBreakdown[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingToday, setLoadingToday] = useState(false);
  const [showOnlyToday, setShowOnlyToday] = useState(true);
  const [accountRequests, setAccountRequests] = useState<AccountRequestType[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [selectedSummaryDate, setSelectedSummaryDate] = useState(new Date().toISOString().split('T')[0]);
  const [planSummary, setPlanSummary] = useState<ManagerSummaryPayload | null>(null);
  const [loadingPlanSummary, setLoadingPlanSummary] = useState(false);
  const [selectedTimelineMember, setSelectedTimelineMember] = useState<string | null>(null);
  const [memberTimeline, setMemberTimeline] = useState<ManagerMemberTimelinePayload | null>(null);
  const [loadingMemberTimeline, setLoadingMemberTimeline] = useState(false);

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const fetchAccountRequests = async () => {
    try {
      setLoadingRequests(true);
      const response = await api.get(`/reports/account-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAccountRequests(response.data);
    } catch (err) {
      console.error("Failed to fetch account requests", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleApproveRequest = async (requestId: string, email: string) => {
    try {
      await api.post(
        `/reports/account-requests/${requestId}/approve`,
        { email },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Request approved! User added to team.");
      fetchAccountRequests();
      fetchAllTeamMembers();
    } catch (err) {
      alert("Failed to approve request");
      console.error(err);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await api.post(
        `/reports/account-requests/${requestId}/reject`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Request rejected.");
      fetchAccountRequests();
    } catch (err) {
      alert("Failed to reject request");
      console.error(err);
    }
  };

  const fetchAllTeamMembers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/auth/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const users = (response.data || []) as Array<{ id: string; email: string; role: string }>;
      const members: TeamMemberType[] = users.filter((u) => u.role === "team_member");
      setTeamMembers(members);
      setMemberTasksByDate({});
      setSelectedMember(null);
    } catch (err) {
      alert("Failed to fetch team members");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchTodayBreakdown = useCallback(async () => {
    try {
      setLoadingToday(true);
      const response = await api.get(`/reports/tasks/today/breakdown`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTodayBreakdown(response.data);
    } catch (err) {
      console.error("Failed to fetch today's tasks breakdown", err);
    } finally {
      setLoadingToday(false);
    }
  }, [token]);

  const fetchMemberTasks = async (memberEmail: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/reports/tasks/by-member/${memberEmail}`, {
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

  const fetchPlanSummary = useCallback(async () => {
    try {
      setLoadingPlanSummary(true);
      const response = await api.get(`/daily-plans/manager/summary?date=${selectedSummaryDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlanSummary(response.data);
    } catch (err) {
      console.error("Failed to fetch daily plan summary", err);
    } finally {
      setLoadingPlanSummary(false);
    }
  }, [selectedSummaryDate, token]);

  const fetchMemberTimeline = useCallback(async (memberEmail: string) => {
    try {
      setLoadingMemberTimeline(true);
      const response = await api.get(`/daily-plans/manager/user/${memberEmail}?date=${selectedSummaryDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedTimelineMember(memberEmail);
      setMemberTimeline(response.data);
    } catch (err) {
      console.error("Failed to fetch member timeline", err);
    } finally {
      setLoadingMemberTimeline(false);
    }
  }, [selectedSummaryDate, token]);

  const handleSelectMember = (memberEmail: string) => {
    fetchMemberTasks(memberEmail);
  };

  useEffect(() => {
    if (token) {
      fetchAllTeamMembers();
      fetchTodayBreakdown();
      fetchPlanSummary();
    }
  }, [token, fetchAllTeamMembers, fetchTodayBreakdown, fetchPlanSummary]);

  useEffect(() => {
    if (token) {
      fetchPlanSummary();
      if (selectedTimelineMember) {
        fetchMemberTimeline(selectedTimelineMember);
      }
    }
  }, [selectedSummaryDate, token, selectedTimelineMember, fetchPlanSummary, fetchMemberTimeline]);

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
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      {/* Sidebar */}
      <div style={{
        width: 280,
        backgroundColor: "#2c3e50",
        color: "white",
        padding: "20px",
        overflowY: "auto",
        boxShadow: "2px 0 8px rgba(0,0,0,0.1)"
      }}>
        <div style={{ marginBottom: 30 }}>
          <h2 style={{ margin: "0 0 10px 0", fontSize: 20, color: "#3498db" }}>📊 PM Dashboard</h2>
          <div style={{ fontSize: 12, color: "#bdc3c7", marginTop: 15 }}>
            <p style={{ margin: "8px 0" }}><strong>User:</strong></p>
            <p style={{ margin: "5px 0", wordBreak: "break-all" }}>{user?.email}</p>
            <p style={{ margin: "8px 0 5px 0" }}><strong>Role:</strong></p>
            <p style={{ margin: "5px 0", textTransform: "capitalize" }}>{user?.role}</p>
          </div>
        </div>

        {/* Team Members Section - shown by default */}
        <div style={{ borderTop: "1px solid #34495e", paddingTop: 20, marginBottom: 20 }}>
          <button
            onClick={onNavigateToTeamMembers}
            style={{
              width: "100%",
              padding: "12px 15px",
              backgroundColor: "#e67e22",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              textAlign: "left",
              fontSize: 14,
              fontWeight: "500",
              transition: "background 0.3s"
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#d35400")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#e67e22")}
          >
            👥 Team Members
          </button>
        </div>

        <div style={{ borderTop: "1px solid #34495e", paddingTop: 20, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 15px 0", fontSize: 14, color: "#95a5a6" }}>NAVIGATION</h3>
          <button
            onClick={onNavigateToProjects}
            style={{
              width: "100%",
              padding: "12px 15px",
              backgroundColor: "#9b59b6",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              marginBottom: 10,
              textAlign: "left",
              fontSize: 14,
              fontWeight: "500",
              transition: "background 0.3s"
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#8e44ad")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#9b59b6")}
          >
            📁 Projects
          </button>
          <button
            onClick={onNavigateToKanban}
            style={{
              width: "100%",
              padding: "12px 15px",
              backgroundColor: "#3498db",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              marginBottom: 10,
              textAlign: "left",
              fontSize: 14,
              fontWeight: "500",
              transition: "background 0.3s"
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#2980b9")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#3498db")}
          >
            📊 Kanban Board
          </button>
          <button
            onClick={onNavigateToChat}
            style={{
              width: "100%",
              padding: "12px 15px",
              backgroundColor: "#2ecc71",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              marginBottom: 10,
              textAlign: "left",
              fontSize: 14,
              fontWeight: "500",
              transition: "background 0.3s"
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#27ae60")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#2ecc71")}
          >
            💬 Team Chat
          </button>
        </div>

        {/* Note: team members sidebar above; removed project-gated section */}

        <div style={{ borderTop: "1px solid #34495e", paddingTop: 20 }}>
          <button
            onClick={logout}
            style={{
              width: "100%",
              padding: "12px 15px",
              backgroundColor: "#e74c3c",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              textAlign: "left",
              fontSize: 14,
              fontWeight: "500",
              transition: "background 0.3s"
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#c0392b")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#e74c3c")}
          >
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: 40, overflowY: "auto" }}>
        <h1 style={{ marginTop: 0, marginBottom: 30 }}>Project Manager Dashboard</h1>

        {/* Home Section - Today's Task Breakdown */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ marginTop: 0 }}>📅 Today's Task Breakdown</h2>
            <button
              onClick={fetchTodayBreakdown}
              disabled={loadingToday}
              style={{
                padding: "8px 16px",
                backgroundColor: "#3498db",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: loadingToday ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: "500"
              }}
            >
              {loadingToday ? "Loading..." : "Refresh"}
            </button>
          </div>

          {loadingToday ? (
            <div style={{ padding: 20, color: "#666" }}>Loading today's tasks...</div>
          ) : todayBreakdown.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
              {todayBreakdown.map((member) => (
                <div
                  key={member.email}
                  onClick={() => handleSelectMember(member.email)}
                  style={{
                    padding: 20,
                    backgroundColor: "white",
                    borderRadius: 8,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    border: "2px solid #ecf0f1",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(52, 152, 219, 0.2)";
                    e.currentTarget.style.borderColor = "#3498db";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                    e.currentTarget.style.borderColor = "#ecf0f1";
                  }}
                >
                  <h4 style={{ margin: "0 0 15px 0", color: "#2c3e50", fontSize: 16 }}>
                    {member.email.split('@')[0]}
                  </h4>
                  
                  <div style={{ marginBottom: 15 }}>
                    <p style={{ margin: "8px 0", fontSize: 13, color: "#666" }}>
                      <strong>Total Tasks:</strong> <span style={{ fontSize: 18, fontWeight: "bold", color: "#3498db" }}>{member.total_tasks}</span>
                    </p>
                  </div>

                  <div style={{ marginBottom: 15, paddingBottom: 15, borderBottom: "1px solid #ecf0f1" }}>
                    <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#7f8c8d", fontWeight: "bold" }}>Status</p>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <span style={{ fontSize: 18, fontWeight: "bold", color: "#999" }}>
                          {member.status_counts["To Do"] || 0}
                        </span>
                        <span style={{ fontSize: 10, color: "#999" }}>To Do</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <span style={{ fontSize: 18, fontWeight: "bold", color: "#007bff" }}>
                          {member.status_counts["In Progress"] || 0}
                        </span>
                        <span style={{ fontSize: 10, color: "#007bff" }}>In Progress</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <span style={{ fontSize: 18, fontWeight: "bold", color: "#28a745" }}>
                          {member.status_counts["Done"] || 0}
                        </span>
                        <span style={{ fontSize: 10, color: "#28a745" }}>Done</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#7f8c8d", fontWeight: "bold" }}>Priority</p>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: "bold", color: "#6bcf7f" }}>
                          {member.priority_counts["Low"] || 0}
                        </span>
                        <span style={{ fontSize: 10, color: "#6bcf7f" }}>Low</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: "bold", color: "#ffd93d" }}>
                          {member.priority_counts["Medium"] || 0}
                        </span>
                        <span style={{ fontSize: 10, color: "#ffd93d" }}>Med</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: "bold", color: "#ff6b6b" }}>
                          {member.priority_counts["High"] || 0}
                        </span>
                        <span style={{ fontSize: 10, color: "#ff6b6b" }}>High</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 20, backgroundColor: "#e8f4f8", borderRadius: 8, color: "#004085" }}>
              No tasks scheduled for today.
            </div>
          )}
        </div>

        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ margin: 0 }}>🕒 Daily Plan vs Actual</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="date"
                value={selectedSummaryDate}
                onChange={(e) => setSelectedSummaryDate(e.target.value)}
                style={{ padding: "8px 10px", border: "1px solid #ddd", borderRadius: 6 }}
              />
              <button
                onClick={fetchPlanSummary}
                disabled={loadingPlanSummary}
                style={{
                  padding: "8px 14px",
                  backgroundColor: "#3498db",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: loadingPlanSummary ? "not-allowed" : "pointer",
                  fontSize: 12,
                  fontWeight: "500"
                }}
              >
                {loadingPlanSummary ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          {planSummary ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
                <div style={{ backgroundColor: "white", borderRadius: 8, padding: 12, border: "1px solid #ecf0f1" }}>
                  <div style={{ fontSize: 12, color: "#7f8c8d" }}>Team Members</div>
                  <div style={{ fontSize: 20, fontWeight: "bold" }}>{planSummary.team_summary.total_team_members}</div>
                </div>
                <div style={{ backgroundColor: "white", borderRadius: 8, padding: 12, border: "1px solid #ecf0f1" }}>
                  <div style={{ fontSize: 12, color: "#7f8c8d" }}>Planned</div>
                  <div style={{ fontSize: 20, fontWeight: "bold" }}>{(planSummary.team_summary.total_planned_minutes / 60).toFixed(2)}h</div>
                </div>
                <div style={{ backgroundColor: "white", borderRadius: 8, padding: 12, border: "1px solid #ecf0f1" }}>
                  <div style={{ fontSize: 12, color: "#7f8c8d" }}>Actual</div>
                  <div style={{ fontSize: 20, fontWeight: "bold" }}>{(planSummary.team_summary.total_actual_minutes / 60).toFixed(2)}h</div>
                </div>
                <div style={{ backgroundColor: "white", borderRadius: 8, padding: 12, border: "1px solid #ecf0f1" }}>
                  <div style={{ fontSize: 12, color: "#7f8c8d" }}>Completion</div>
                  <div style={{ fontSize: 20, fontWeight: "bold" }}>{planSummary.team_summary.completion_rate_percent}%</div>
                </div>
              </div>

              <div style={{ backgroundColor: "white", borderRadius: 8, border: "1px solid #ecf0f1", overflow: "hidden", marginBottom: 14 }}>
                {planSummary.members.map((member) => (
                  <div
                    key={member.user_email}
                    onClick={() => fetchMemberTimeline(member.user_email)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                      gap: 10,
                      padding: "10px 12px",
                      borderBottom: "1px solid #f4f6f8",
                      cursor: "pointer",
                      backgroundColor: selectedTimelineMember === member.user_email ? "#eaf2ff" : "white"
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{member.user_email}</div>
                    <div>{(member.planned_minutes / 60).toFixed(2)}h</div>
                    <div>{(member.actual_minutes / 60).toFixed(2)}h</div>
                    <div style={{ color: member.variance_minutes > 0 ? "#e67e22" : "#27ae60" }}>{(member.variance_minutes / 60).toFixed(2)}h</div>
                    <div>{member.completed_blocks}/{member.completed_blocks + member.pending_blocks}</div>
                  </div>
                ))}
              </div>

              {loadingMemberTimeline && <div style={{ padding: 12, color: "#666" }}>Loading member timeline...</div>}

              {!loadingMemberTimeline && memberTimeline && (
                <div style={{ backgroundColor: "white", borderRadius: 8, border: "1px solid #ecf0f1", padding: 12 }}>
                  <h4 style={{ marginTop: 0, marginBottom: 10 }}>Timeline: {memberTimeline.user_email}</h4>
                  {(memberTimeline.timeline || []).length === 0 ? (
                    <p style={{ margin: 0, color: "#999" }}>No plan available for selected date.</p>
                  ) : (
                    (memberTimeline.timeline || []).map((entry, idx) => (
                      <div key={`${entry.type}-${idx}`} style={{
                        padding: "8px 10px",
                        borderRadius: 6,
                        marginBottom: 8,
                        backgroundColor: entry.type === "gap" ? "#fafafa" : "#f4f8ff",
                        borderLeft: `4px solid ${entry.type === "gap" ? "#cfd8dc" : "#3498db"}`
                      }}>
                        <strong>{entry.from} - {entry.to}</strong>
                        {entry.type === "gap" ? " • Free slot" : ` • ${entry.task_title}${entry.sub_task ? ` (${entry.sub_task})` : ""}`}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: 20, backgroundColor: "#e8f4f8", borderRadius: 8, color: "#004085" }}>
              No daily planning data available for this date.
            </div>
          )}
        </div>

        <div style={{ marginBottom: 30 }}>
          <h2 style={{ marginBottom: 15 }}>Tasks Overview</h2>

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

          {teamMembers.length === 0 && !loading && (
            <div style={{ padding: 20, backgroundColor: "#e8f4f8", borderRadius: 8, color: "#004085" }}>
              No team members found. Approve requests or add users to see them here.
            </div>
          )}
        </div>

        {/* Account Creation Requests Section */}
        <div style={{ marginBottom: 30 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
            <h2>📥 Account Creation Requests</h2>
            <button
              onClick={fetchAccountRequests}
              disabled={loadingRequests}
              style={{
                padding: "8px 16px",
                backgroundColor: "#3498db",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: loadingRequests ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: "500"
              }}
            >
              {loadingRequests ? "Loading..." : "Refresh"}
            </button>
          </div>

          {accountRequests.filter(req => req.status === "pending").length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 15 }}>
              {accountRequests
                .filter(req => req.status === "pending")
                .map((request) => (
                  <div
                    key={request._id}
                    style={{
                      padding: 15,
                      backgroundColor: "white",
                      border: "2px solid #f39c12",
                      borderRadius: 8,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                    }}
                  >
                    <div style={{ marginBottom: 12 }}>
                      <h4 style={{ margin: "0 0 5px 0", color: "#333" }}>{request.email}</h4>
                      <p style={{ margin: "5px 0", fontSize: 12, color: "#666" }}>
                        📅 Requested: {new Date(request.requested_at).toLocaleDateString()}
                      </p>
                      <p style={{ margin: "5px 0", fontSize: 12, color: "#999" }}>
                        Status: <strong style={{ color: "#f39c12" }}>Pending</strong>
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        onClick={() => handleApproveRequest(request._id, request.email)}
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          backgroundColor: "#27ae60",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: "500"
                        }}
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request._id)}
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          backgroundColor: "#e74c3c",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: "500"
                        }}
                      >
                        ✗ Reject
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div style={{ padding: 20, backgroundColor: "#e8f4f8", borderRadius: 8, color: "#004085" }}>
              No pending account requests at this time.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
