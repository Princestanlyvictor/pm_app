import { useMemo, useState } from "react";
import type { ProjectMember, RoadmapStage, WorkspaceTask } from "../../types/projectWorkspace";

interface TaskFilters {
  status: string;
  assignee: string;
  priority: string;
  stage: string;
}

interface CreateTaskPayload {
  title: string;
  description: string;
  status: string;
  priority: string;
  stage?: string;
  task_date: string;
  due_date?: string;
  estimated_time?: number;
  dependencies: string[];
  assigned_to: string[];
}

interface ProjectTasksTabProps {
  loading: boolean;
  canCreate: boolean;
  tasksView: "list" | "kanban";
  listItems: WorkspaceTask[];
  kanbanItems: Record<string, WorkspaceTask[]>;
  filters: TaskFilters;
  members: ProjectMember[];
  stages: RoadmapStage[];
  onViewChange: (view: "list" | "kanban") => void;
  onFilterChange: (key: keyof TaskFilters, value: string) => void;
  onRefresh: () => void;
  onCreateTask: (payload: CreateTaskPayload) => Promise<void>;
}

export default function ProjectTasksTab({
  loading,
  canCreate,
  tasksView,
  listItems,
  kanbanItems,
  filters,
  members,
  stages,
  onViewChange,
  onFilterChange,
  onRefresh,
  onCreateTask,
}: ProjectTasksTabProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateTaskPayload>({
    title: "",
    description: "",
    status: "To Do",
    priority: "Medium",
    stage: stages[0]?.name,
    task_date: new Date().toISOString().split("T")[0],
    due_date: new Date().toISOString().split("T")[0],
    dependencies: [],
    assigned_to: [],
  });
  const [saving, setSaving] = useState(false);

  const statuses = useMemo(() => ["To Do", "In Progress", "Done"], []);

  const handleCreate = async () => {
    if (!form.title.trim()) {
      alert("Task title is required");
      return;
    }

    try {
      setSaving(true);
      await onCreateTask(form);
      setForm({
        title: "",
        description: "",
        status: "To Do",
        priority: "Medium",
        stage: stages[0]?.name,
        task_date: new Date().toISOString().split("T")[0],
        due_date: new Date().toISOString().split("T")[0],
        dependencies: [],
        assigned_to: [],
      });
      setShowCreate(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ backgroundColor: "#fff", borderRadius: 12, border: "1px solid #ECEEF5", boxShadow: "0 6px 20px rgba(14,10,60,0.06)", padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          <select value={filters.status} onChange={(event) => onFilterChange("status", event.target.value)} style={{ padding: 9, borderRadius: 8, border: "1px solid #d9dcea" }}>
            <option value="">All Status</option>
            {statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <select value={filters.assignee} onChange={(event) => onFilterChange("assignee", event.target.value)} style={{ padding: 9, borderRadius: 8, border: "1px solid #d9dcea" }}>
            <option value="">All Assignees</option>
            {members.map((member) => (
              <option key={member.email} value={member.email}>{member.email}</option>
            ))}
          </select>
          <select value={filters.priority} onChange={(event) => onFilterChange("priority", event.target.value)} style={{ padding: 9, borderRadius: 8, border: "1px solid #d9dcea" }}>
            <option value="">All Priority</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select value={filters.stage} onChange={(event) => onFilterChange("stage", event.target.value)} style={{ padding: 9, borderRadius: 8, border: "1px solid #d9dcea" }}>
            <option value="">All Stages</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.name}>{stage.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => onViewChange("list")}
              style={{
                border: "none",
                borderRadius: 8,
                padding: "8px 12px",
                backgroundColor: tasksView === "list" ? "#0E0A3C" : "#EEF0F6",
                color: tasksView === "list" ? "white" : "#444",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              List View
            </button>
            <button
              type="button"
              onClick={() => onViewChange("kanban")}
              style={{
                border: "none",
                borderRadius: 8,
                padding: "8px 12px",
                backgroundColor: tasksView === "kanban" ? "#0E0A3C" : "#EEF0F6",
                color: tasksView === "kanban" ? "white" : "#444",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Kanban View
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {canCreate && (
              <button
                type="button"
                onClick={() => setShowCreate((value) => !value)}
                style={{
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  backgroundColor: "#FF7A00",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {showCreate ? "Cancel" : "Add Task"}
              </button>
            )}
            <button type="button" onClick={onRefresh} style={{ border: "none", borderRadius: 8, padding: "8px 12px", backgroundColor: "#E9ECF7", cursor: "pointer", fontWeight: 600 }}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {showCreate && (
        <div style={{ backgroundColor: "#fff", borderRadius: 12, border: "1px solid #ECEEF5", padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Create Task</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input placeholder="Task title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} style={{ padding: 10, border: "1px solid #d9dcea", borderRadius: 8 }} />
            <select value={form.stage ?? ""} onChange={(event) => setForm({ ...form, stage: event.target.value })} style={{ padding: 10, border: "1px solid #d9dcea", borderRadius: 8 }}>
              <option value="">Select stage</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.name}>{stage.name}</option>
              ))}
            </select>
            <textarea placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} style={{ gridColumn: "1 / -1", padding: 10, border: "1px solid #d9dcea", borderRadius: 8, minHeight: 80 }} />
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} style={{ padding: 10, border: "1px solid #d9dcea", borderRadius: 8 }}>
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} style={{ padding: 10, border: "1px solid #d9dcea", borderRadius: 8 }}>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <input type="date" value={form.task_date} onChange={(event) => setForm({ ...form, task_date: event.target.value })} style={{ padding: 10, border: "1px solid #d9dcea", borderRadius: 8 }} />
            <input type="date" value={form.due_date ?? ""} onChange={(event) => setForm({ ...form, due_date: event.target.value })} style={{ padding: 10, border: "1px solid #d9dcea", borderRadius: 8 }} />
            <input type="number" placeholder="Estimated hours" value={form.estimated_time ?? ""} onChange={(event) => setForm({ ...form, estimated_time: event.target.value ? Number(event.target.value) : undefined })} style={{ padding: 10, border: "1px solid #d9dcea", borderRadius: 8 }} />
            <input
              placeholder="Assignees (comma-separated emails)"
              value={form.assigned_to.join(",")}
              onChange={(event) => setForm({ ...form, assigned_to: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })}
              style={{ padding: 10, border: "1px solid #d9dcea", borderRadius: 8 }}
            />
            <input
              placeholder="Dependencies (comma-separated emails)"
              value={form.dependencies.join(",")}
              onChange={(event) => setForm({ ...form, dependencies: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })}
              style={{ gridColumn: "1 / -1", padding: 10, border: "1px solid #d9dcea", borderRadius: 8 }}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              style={{ border: "none", borderRadius: 8, padding: "10px 14px", backgroundColor: "#0E0A3C", color: "white", cursor: "pointer", fontWeight: 700 }}
            >
              {saving ? "Saving..." : "Create Task"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ backgroundColor: "#fff", borderRadius: 12, border: "1px solid #ECEEF5", padding: 16 }}>Loading tasks...</div>
      ) : tasksView === "list" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {listItems.map((task) => (
            <div key={task.id} style={{ backgroundColor: "#fff", border: "1px solid #ECEEF5", borderLeft: `4px solid ${task.priority === "High" ? "#e53935" : task.priority === "Medium" ? "#FF7A00" : "#2E7D32"}`, borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>{task.title}</strong>
                <span style={{ fontSize: 12, backgroundColor: "#EFF2FF", color: "#0E0A3C", borderRadius: 999, padding: "3px 8px" }}>{task.status}</span>
              </div>
              <p style={{ color: "#6B7280", fontSize: 13, minHeight: 36 }}>{task.description || "No description"}</p>
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                <div>Stage: {task.stage || "-"}</div>
                <div>Due: {task.due_date || task.task_date}</div>
                <div>Assignees: {(task.assigned_to || []).join(", ") || "-"}</div>
              </div>
            </div>
          ))}
          {listItems.length === 0 && <div style={{ color: "#6B7280" }}>No tasks match current filters.</div>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {statuses.map((status) => (
            <div key={status} style={{ backgroundColor: "#F8F9FC", borderRadius: 12, border: "1px solid #ECEEF5", padding: 12 }}>
              <h4 style={{ marginTop: 0 }}>{status}</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(kanbanItems[status] || []).map((task) => (
                  <div key={task.id} style={{ backgroundColor: "#fff", borderRadius: 10, border: "1px solid #E8EAF2", padding: 10 }}>
                    <strong style={{ fontSize: 14 }}>{task.title}</strong>
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>Priority: {task.priority}</div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>Stage: {task.stage || "-"}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
