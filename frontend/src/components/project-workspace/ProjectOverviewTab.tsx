import type { CSSProperties } from "react";
import type { WorkspacePayload } from "../../types/projectWorkspace";

interface ProjectOverviewTabProps {
  workspace: WorkspacePayload | null;
  loading: boolean;
  onRefresh: () => void;
}

const cardStyle: CSSProperties = {
  backgroundColor: "#FFFFFF",
  borderRadius: 12,
  boxShadow: "0 6px 20px rgba(14,10,60,0.08)",
  border: "1px solid #EAEAF0",
  padding: 16,
};

export default function ProjectOverviewTab({ workspace, loading, onRefresh }: ProjectOverviewTabProps) {
  if (loading) {
    return <div style={cardStyle}>Loading workspace overview...</div>;
  }

  if (!workspace) {
    return <div style={cardStyle}>Select a project to view its workspace overview.</div>;
  }

  const stats = workspace.stats;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div style={{ ...cardStyle, backgroundColor: "#0E0A3C", color: "white" }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Total Tasks</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{stats.total_tasks}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: "4px solid #2E7D32" }}>
          <div style={{ fontSize: 12, color: "#6B7280" }}>Completed</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{stats.completed_tasks}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: "4px solid #FF7A00" }}>
          <div style={{ fontSize: 12, color: "#6B7280" }}>Pending</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{stats.pending_tasks}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: "4px solid #D32F2F" }}>
          <div style={{ fontSize: 12, color: "#6B7280" }}>Overdue</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{stats.overdue_tasks}</div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Progress</h3>
          <button
            type="button"
            onClick={onRefresh}
            style={{
              border: "none",
              backgroundColor: "#FF7A00",
              color: "white",
              borderRadius: 8,
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Refresh
          </button>
        </div>
        <div style={{ marginTop: 10, backgroundColor: "#ECEEF5", borderRadius: 999, height: 12, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.max(0, Math.min(100, stats.progress_percent))}%`,
              background: "linear-gradient(90deg, #0E0A3C, #FF7A00)",
            }}
          />
        </div>
        <p style={{ marginBottom: 0, color: "#6B7280" }}>{stats.progress_percent}% complete</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Recent Activity</h3>
          {workspace.recent_activity.length === 0 ? (
            <p style={{ color: "#6B7280" }}>No recent activity yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {workspace.recent_activity.slice(0, 10).map((activity, index) => (
                <div key={`${activity.created_at}-${index}`} style={{ borderBottom: "1px solid #F1F2F7", paddingBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>{activity.message}</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>
                    {activity.actor_email} • {new Date(activity.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...cardStyle, borderLeft: "4px solid #EF4444" }}>
          <h3 style={{ marginTop: 0 }}>Blocked Risks</h3>
          {workspace.blocked_tasks.length === 0 ? (
            <p style={{ color: "#6B7280" }}>No blocked tasks.</p>
          ) : (
            workspace.blocked_tasks.slice(0, 8).map((task) => (
              <div key={task.id} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{task.title}</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>
                  {task.unresolved_dependencies.length} unresolved dependencies
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Team Workload Distribution</h3>
        {workspace.workload_distribution.length === 0 ? (
          <p style={{ color: "#6B7280" }}>No workload data yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {workspace.workload_distribution.map((item) => (
              <div key={item.email} style={{ backgroundColor: "#F8F9FC", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 600 }}>{item.email}</div>
                <div style={{ color: "#6B7280", fontSize: 13 }}>{item.task_count} tasks</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
