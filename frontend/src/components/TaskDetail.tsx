import { useState, useEffect } from "react";
import api from "../services/api";
import TaskChat from "./TaskChat";

interface TaskDetailProps {
  taskId: string;
  token: string;
  currentEmail: string;
  onClose: () => void;
  onUpdate: () => void;
  projectTeamMembers?: string[];
}

export default function TaskDetail({
  taskId,
  token,
  currentEmail,
  onClose,
  onUpdate,
  projectTeamMembers = []
}: TaskDetailProps) {
  const [task, setTask] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "To Do",
    priority: "Medium",
    estimated_time: "",
    dependencies: [] as string[]
  });

  useEffect(() => {
    fetchTaskDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const fetchTaskDetail = async () => {
    try {
      const response = await api.get(`/reports/task/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTask(response.data);
      setFormData({
        title: response.data.title,
        description: response.data.description,
        status: response.data.status,
        priority: response.data.priority,
        estimated_time: response.data.estimated_time?.toString() || "",
        dependencies: response.data.dependencies || []
      });
    } catch (error: unknown) {
      console.error(error);
      setError("Failed to fetch task details");
    }
  };

  const handleSaveTask = async () => {
    try {
      setLoading(true);
      setError("");
      await api.put(
        `/reports/task/${taskId}`,
        {
          title: formData.title,
          description: formData.description,
          status: formData.status,
          priority: formData.priority,
          estimated_time: formData.estimated_time ? parseInt(formData.estimated_time) : null,
          dependencies: formData.dependencies
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsEditing(false);
      await fetchTaskDetail();
      onUpdate();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || "Failed to update task");
    } finally {
      setLoading(false);
    }
  };

  const toggleAssignee = (email: string) => {
    setFormData(prev => ({
      ...prev,
      dependencies: prev.dependencies.includes(email)
        ? prev.dependencies.filter(e => e !== email)
        : [...prev.dependencies, email]
    }));
  };

  if (!task) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <p>Loading task details...</p>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "white",
        borderRadius: 8,
        maxWidth: 700,
        maxHeight: "90vh",
        overflowY: "auto",
        width: "95%",
        padding: 30
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>{task.title}</h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: "#f5f5f5",
              border: "none",
              borderRadius: 4,
              padding: 8,
              cursor: "pointer",
              fontSize: 18
            }}
          >
            X
          </button>
        </div>

        {error && <div style={{ backgroundColor: "#f8d7da", color: "#721c24", padding: 10, borderRadius: 4, marginBottom: 15 }}>{error}</div>}

        {!isEditing ? (
          // View Mode
          <div>
            <div style={{ marginBottom: 20 }}>
              <p><strong>Description:</strong> {task.description}</p>
              <p><strong>Status:</strong> {task.status}</p>
              <p><strong>Priority:</strong> {task.priority}</p>
              <p><strong>Task Date:</strong> {task.task_date}</p>
              <p><strong>Estimated Time:</strong> {task.estimated_time ? `${task.estimated_time} hours` : "Not set"}</p>
              <p><strong>Created by:</strong> {task.created_by}</p>
              {task.dependencies?.length > 0 && (
                <p><strong>Tagged Team Members:</strong> {task.dependencies.join(", ")}</p>
              )}
            </div>

            <button
              onClick={() => setIsEditing(true)}
              style={{
                padding: 10,
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                marginBottom: 20
              }}
            >
              Edit Task
            </button>

            <TaskChat taskId={taskId} token={token} currentEmail={currentEmail} />
          </div>
        ) : (
          // Edit Mode
          <div>
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>Title:</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ddd" }}
              />
            </div>

            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>Description:</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ddd", minHeight: 80 }}
              />
            </div>

            <div style={{ marginBottom: 15, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
              <div>
                <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>Status:</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ddd" }}
                >
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>Priority:</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ddd" }}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>Estimated Time (hours):</label>
              <input
                type="number"
                value={formData.estimated_time}
                onChange={(e) => setFormData({ ...formData, estimated_time: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ddd" }}
              />
            </div>

            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>Tag Team Members (Dependencies):</label>
              <div style={{ backgroundColor: "#f9f9f9", padding: 10, borderRadius: 4 }}>
                {projectTeamMembers.length === 0 ? (
                  <p style={{ margin: 0, color: "#666" }}>No team members available to tag</p>
                ) : (
                  projectTeamMembers.map((member) => (
                    <label key={member} style={{ display: "block", marginBottom: 8, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={formData.dependencies.includes(member)}
                        onChange={() => toggleAssignee(member)}
                        style={{ marginRight: 8 }}
                      />
                      {member}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleSaveTask}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: 10,
                  backgroundColor: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer"
                }}
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                style={{
                  flex: 1,
                  padding: 10,
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
