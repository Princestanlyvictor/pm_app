import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";
import "../styles/HourlyTaskBreakdown.css";

interface HourlyTaskBreakdownProps {
  onNavigateToTeamMemberDashboard?: () => void;
  onNavigateToProjects?: () => void;
}

// ============================================
// NESTED SUBTASK SYSTEM - Data Structures
// ============================================

interface Subtask {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "critical";
  assignee?: string;
  due_date?: string;
  estimated_days?: number;
}

interface TreeTask {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "critical";
  assignee?: string;
  due_date?: string;
  estimated_days?: number;
  created_date: string;
  subtasks: Subtask[];
  expanded?: boolean; // UI state
  adding_subtask?: boolean; // UI state for inline creation
}

// Keep backward compatibility with existing types
interface PlannableTask {
  id: string;
  project_id: string;
  title: string;
  status: string;
  priority: string;
  estimated_time?: number;
  progress_percent?: number;
}

interface WorkBlock {
  _id: string;
  task_id: string;
  project_id: string;
  task_title: string;
  sub_task: string;
  start_time: string;
  end_time: string;
  estimated_minutes: number;
  actual_minutes: number;
  status: "planned" | "in_progress" | "completed" | "delayed" | "paused";
  eod_status?: "completed" | "partially_completed" | "not_done";
  delay_reason?: string;
}

interface TimelineEntry {
  type: "gap" | "work_block";
  id?: string;
  from: string;
  to: string;
  minutes?: number;
  task_title?: string;
  sub_task?: string;
  status?: WorkBlock["status"];
  estimated_minutes?: number;
  actual_minutes?: number;
}

interface PlanPayload {
  plan: {
    id: string;
    date: string;
    available_minutes: number;
    total_planned_minutes: number;
    total_actual_minutes: number;
    status: string;
  };
  work_blocks: WorkBlock[];
  timeline: TimelineEntry[];
  alerts: Array<{ type: string; message: string }>;
  plannable_tasks: PlannableTask[];
}

const initialForm = {
  task_id: "",
  sub_task: "",
  start_time: "09:00",
  end_time: "10:00",
  estimated_minutes: "60",
};

const HourlyTaskBreakdown: React.FC<HourlyTaskBreakdownProps> = ({
  onNavigateToTeamMemberDashboard,
  onNavigateToProjects,
}) => {
  const { token } = useContext(AuthContext);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [planData, setPlanData] = useState<PlanPayload | null>(null);
  const [taskFilterProject, setTaskFilterProject] = useState<string>("");
  const [form, setForm] = useState(initialForm);
  const [capacityInput, setCapacityInput] = useState("480");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [eodByBlock, setEodByBlock] = useState<Record<string, { eod_status: "completed" | "partially_completed" | "not_done"; actual_minutes: string; delay_reason: string }>>({});

  // ============================================
  // NESTED SUBTASK SYSTEM - State
  // ============================================
  const [view, setView] = useState<"daily-planning" | "task-management">("task-management");
  const [tasks, setTasks] = useState<TreeTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [newTaskForm, setNewTaskForm] = useState({
    title: "",
    description: "",
    priority: "medium" as const,
    project_id: "",
  });
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string>("");
  const [newSubtaskForm, setNewSubtaskForm] = useState({
    title: "",
    priority: "medium" as const,
  });

  const getTodayDate = () => new Date().toISOString().split("T")[0];

  // ============================================
  // NESTED SUBTASK SYSTEM - Helper Functions
  // ============================================

  /** Calculate progress percentage for a task (% of completed subtasks) */
  const calculateTaskProgress = (task: TreeTask): number => {
    if (task.subtasks.length === 0) {
      return task.status === "completed" ? 100 : 0;
    }
    const completed = task.subtasks.filter((st) => st.status === "completed").length;
    return Math.round((completed / task.subtasks.length) * 100);
  };

  /** Auto-complete parent task if all subtasks are done */
  const checkParentCompletion = (taskId: string, updatedTasks: TreeTask[]) => {
    const task = updatedTasks.find((t) => t.id === taskId);
    if (task && task.subtasks.length > 0) {
      const allDone = task.subtasks.every((st) => st.status === "completed");
      if (allDone && task.status !== "completed") {
        task.status = "completed";
      }
    }
  };

  /** Prevent circular hierarchy (simplified version) */
  const canAddSubtask = (parentTaskId: string): boolean => {
    // Max 2-level nesting: root task -> subtask (no sub-subtasks)
    return true; // Subtasks are always leaf nodes
  };

  /** Load all tasks from backend */
  const loadTasks = useCallback(async () => {
    if (!token) return;
    setTasksLoading(true);
    setErrorMessage("");
    try {
      const response = await api.get("/tasks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Assuming backend returns tasks with subtasks nested
      const loadedTasks: TreeTask[] = response.data.tasks || [];
      setTasks(loadedTasks.map((t) => ({ ...t, expanded: false, adding_subtask: false })));
    } catch (error) {
      console.error("Failed to load tasks", error);
      setErrorMessage("Failed to load tasks.");
      // Seed with mock data if available
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (view === "task-management" && token) {
      loadTasks();
    }
  }, [view, token, loadTasks]);
    setLoading(true);
    setErrorMessage("");
    try {
      const response = await api.get(`/daily-plans/me?date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlanData(response.data);
      setCapacityInput(String(response.data.plan?.available_minutes ?? 480));
    } catch (error) {
      console.error("Failed to load daily plan", error);
      setErrorMessage("Failed to load daily plan.");
      setPlanData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, token]);

  useEffect(() => {
    if (token) {
      loadPlan();
    }
  }, [token, loadPlan]);

  const filteredTasks = useMemo(() => {
    if (!planData?.plannable_tasks) return [];
    if (!taskFilterProject) return planData.plannable_tasks;
    return planData.plannable_tasks.filter((task) => task.project_id === taskFilterProject);
  }, [planData, taskFilterProject]);

  const projectOptions = useMemo(() => {
    const projects = new Set<string>();
    (planData?.plannable_tasks || []).forEach((task) => projects.add(task.project_id));
    return Array.from(projects);
  }, [planData]);

  const selectedTask = useMemo(
    () => (planData?.plannable_tasks || []).find((task) => task.id === form.task_id),
    [planData, form.task_id]
  );

  const toHours = (minutes: number) => (minutes / 60).toFixed(2);

  const statusClass = (status?: string) => {
    switch (status) {
      case "in_progress":
        return "status-in-progress";
      case "completed":
        return "status-completed";
      case "delayed":
        return "status-delayed";
      case "paused":
        return "status-paused";
      default:
        return "status-planned";
    }
  };

  const addWorkBlock = async () => {
    if (!selectedTask) {
      setErrorMessage("Please select a task.");
      return;
    }

    const estimated = Number(form.estimated_minutes);
    if (!Number.isFinite(estimated) || estimated <= 0) {
      setErrorMessage("ETA should be a valid number of minutes.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    try {
      await api.post(
        `/daily-plans/me/blocks?date=${selectedDate}`,
        {
          task_id: selectedTask.id,
          project_id: selectedTask.project_id,
          sub_task: form.sub_task,
          start_time: form.start_time,
          end_time: form.end_time,
          estimated_minutes: estimated,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setForm(initialForm);
      await loadPlan();
    } catch (error: unknown) {
      const typed = error as { response?: { data?: { detail?: string } } };
      setErrorMessage(typed.response?.data?.detail || "Failed to add work block.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateCapacity = async () => {
    const value = Number(capacityInput);
    if (!Number.isFinite(value) || value < 60 || value > 1440) {
      setErrorMessage("Daily capacity must be between 60 and 1440 minutes.");
      return;
    }

    try {
      await api.patch(
        `/daily-plans/me/capacity?date=${selectedDate}`,
        { available_minutes: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadPlan();
    } catch (error: unknown) {
      const typed = error as { response?: { data?: { detail?: string } } };
      setErrorMessage(typed.response?.data?.detail || "Failed to update capacity.");
    }
  };

  const blockAction = async (blockId: string, action: "start" | "pause" | "resume" | "complete") => {
    try {
      await api.post(`/daily-plans/me/blocks/${blockId}/${action}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      await loadPlan();
    } catch (error: unknown) {
      const typed = error as { response?: { data?: { detail?: string } } };
      setErrorMessage(typed.response?.data?.detail || `Failed to ${action} block.`);
    }
  };

  const deleteBlock = async (blockId: string) => {
    try {
      await api.delete(`/daily-plans/me/blocks/${blockId}`, { headers: { Authorization: `Bearer ${token}` } });
      await loadPlan();
    } catch (error: unknown) {
      const typed = error as { response?: { data?: { detail?: string } } };
      setErrorMessage(typed.response?.data?.detail || "Failed to delete block.");
    }
  };

  const submitEod = async (block: WorkBlock) => {
    const payload = eodByBlock[block._id];
    if (!payload) {
      setErrorMessage("Please fill EOD details before submitting.");
      return;
    }

    const actualMinutes = Number(payload.actual_minutes);
    if (!Number.isFinite(actualMinutes) || actualMinutes < 0) {
      setErrorMessage("Actual minutes must be a valid non-negative number.");
      return;
    }

    try {
      await api.post(
        `/daily-plans/me/blocks/${block._id}/eod`,
        {
          eod_status: payload.eod_status,
          actual_minutes: actualMinutes,
          delay_reason: payload.delay_reason,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadPlan();
    } catch (error: unknown) {
      const typed = error as { response?: { data?: { detail?: string } } };
      setErrorMessage(typed.response?.data?.detail || "Failed to submit EOD update.");
    }
  };

  return (
    <div className="hourly-task-breakdown">
      <div className="htb-header">
        <div className="htb-header-top">
          <h1> Daily Task Breakdown & Time Tracking</h1>
          <div className="htb-nav-buttons">
            {onNavigateToTeamMemberDashboard && (
              <button className="nav-btn secondary" onClick={onNavigateToTeamMemberDashboard}>
                Back Back to Dashboard
              </button>
            )}
            {onNavigateToProjects && (
              <button className="nav-btn secondary" onClick={onNavigateToProjects}>
                 Projects
              </button>
            )}
          </div>
        </div>

        <div className="htb-controls">
          <div className="control-group">
            <label htmlFor="date-picker">Date</label>
            <input id="date-picker" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="htb-input" />
          </div>
          <div className="control-group">
            <label htmlFor="capacity">Daily Capacity (minutes)</label>
            <input id="capacity" type="number" className="htb-input" value={capacityInput} onChange={(e) => setCapacityInput(e.target.value)} />
          </div>
          <div className="control-group">
            <button className="nav-btn primary" onClick={updateCapacity}>Update Capacity</button>
          </div>
          <div className="control-group">
            <button className="nav-btn primary" onClick={() => setSelectedDate(getTodayDate())}>Today</button>
          </div>
          <div className="control-group">
            <button className="nav-btn secondary" onClick={loadPlan}>Refresh</button>
          </div>
        </div>

        {!!planData && (
          <div className="htb-summary">
            <div className="summary-stat">
              <span className="stat-label">Planned</span>
              <span className="stat-value">{toHours(planData.plan.total_planned_minutes)}h</span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Actual</span>
              <span className="stat-value">{toHours(planData.plan.total_actual_minutes)}h</span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Capacity</span>
              <span className="stat-value">{toHours(planData.plan.available_minutes)}h</span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Variance</span>
              <span className="stat-value">{toHours(planData.plan.total_actual_minutes - planData.plan.total_planned_minutes)}h</span>
            </div>
          </div>
        )}
      </div>

      {errorMessage && <div className="error-banner">{errorMessage}</div>}

      <div className="add-block-panel">
        <h3>Morning Planning: Add Work Block</h3>
        <div className="add-block-grid">
          <div className="control-group">
            <label>Project Filter</label>
            <select className="htb-select" value={taskFilterProject} onChange={(e) => setTaskFilterProject(e.target.value)}>
              <option value="">All Projects</option>
              {projectOptions.map((projectId) => (
                <option key={projectId} value={projectId}>{projectId}</option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label>Task</label>
            <select className="htb-select" value={form.task_id} onChange={(e) => setForm((prev) => ({ ...prev, task_id: e.target.value }))}>
              <option value="">Select task</option>
              {filteredTasks.map((task) => (
                <option key={task.id} value={task.id}>{task.title} ({task.status})</option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label>Sub-task / Description</label>
            <input className="htb-input" value={form.sub_task} onChange={(e) => setForm((prev) => ({ ...prev, sub_task: e.target.value }))} />
          </div>
          <div className="control-group">
            <label>From</label>
            <input type="time" className="htb-input" value={form.start_time} onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))} />
          </div>
          <div className="control-group">
            <label>To</label>
            <input type="time" className="htb-input" value={form.end_time} onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))} />
          </div>
          <div className="control-group">
            <label>ETA (minutes)</label>
            <input type="number" className="htb-input" value={form.estimated_minutes} onChange={(e) => setForm((prev) => ({ ...prev, estimated_minutes: e.target.value }))} />
          </div>
          <div className="control-group">
            <label>&nbsp;</label>
            <button className="nav-btn primary" onClick={addWorkBlock} disabled={submitting}>{submitting ? "Adding..." : "Add Block"}</button>
          </div>
        </div>
      </div>

      {planData?.alerts?.length ? (
        <div className="alerts-panel">
          {planData.alerts.map((alert, idx) => (
            <div key={`${alert.type}-${idx}`} className="alert-item"> {alert.message}</div>
          ))}
        </div>
      ) : null}

      <div className="htb-content">
        {loading ? (
          <div className="loading-spinner">Loading plan...</div>
        ) : !planData ? (
          <div className="empty-state"><p>No daily plan found.</p></div>
        ) : (
          <>
            <div className="timeline-panel">
              <h3>Visual Timeline</h3>
              <div className="timeline-list">
                {planData.timeline.length === 0 ? (
                  <p className="no-tasks">No timeline entries yet</p>
                ) : (
                  planData.timeline.map((entry, idx) => (
                    <div key={`${entry.type}-${entry.id || idx}`} className={`timeline-item ${entry.type === "gap" ? "gap-item" : statusClass(entry.status)}`}>
                      <div className="timeline-time">{entry.from} - {entry.to}</div>
                      {entry.type === "gap" ? (
                        <div className="timeline-title">Free Time ({entry.minutes} mins)</div>
                      ) : (
                        <div className="timeline-title">
                          {entry.task_title}
                          {entry.sub_task ? ` - ${entry.sub_task}` : ""}
                          <span className="timeline-meta"> ETA {entry.estimated_minutes}m / Actual {entry.actual_minutes}m</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="timeline-panel">
              <h3>Execution + EOD Updates</h3>
              {planData.work_blocks.length === 0 ? (
                <p className="no-tasks">No work blocks planned yet.</p>
              ) : (
                <div className="blocks-table">
                  {planData.work_blocks.map((block) => {
                    const eodState = eodByBlock[block._id] || {
                      eod_status: "completed",
                      actual_minutes: String(block.actual_minutes || block.estimated_minutes),
                      delay_reason: block.delay_reason || "",
                    };

                    return (
                      <div key={block._id} className="block-row">
                        <div className="block-main">
                          <div className="block-title">{block.task_title}</div>
                          <div className="block-sub">{block.start_time} - {block.end_time} - ETA {block.estimated_minutes}m - Status {block.status}</div>
                          {block.sub_task ? <div className="block-sub">Sub-task: {block.sub_task}</div> : null}
                        </div>

                        <div className="block-actions">
                          <button className="mini-btn" onClick={() => blockAction(block._id, "start")}>Start</button>
                          <button className="mini-btn" onClick={() => blockAction(block._id, "pause")}>Pause</button>
                          <button className="mini-btn" onClick={() => blockAction(block._id, "resume")}>Resume</button>
                          <button className="mini-btn" onClick={() => blockAction(block._id, "complete")}>Complete</button>
                          <button className="mini-btn delete" onClick={() => deleteBlock(block._id)}>Delete</button>
                        </div>

                        <div className="eod-grid">
                          <select
                            className="htb-select"
                            value={eodState.eod_status}
                            onChange={(e) =>
                              setEodByBlock((prev) => ({
                                ...prev,
                                [block._id]: { ...eodState, eod_status: e.target.value as "completed" | "partially_completed" | "not_done" },
                              }))
                            }
                          >
                            <option value="completed">Completed</option>
                            <option value="partially_completed">Partially Completed</option>
                            <option value="not_done">Not Done</option>
                          </select>
                          <input
                            className="htb-input"
                            type="number"
                            value={eodState.actual_minutes}
                            onChange={(e) =>
                              setEodByBlock((prev) => ({ ...prev, [block._id]: { ...eodState, actual_minutes: e.target.value } }))
                            }
                            placeholder="Actual minutes"
                          />
                          <input
                            className="htb-input"
                            value={eodState.delay_reason}
                            onChange={(e) =>
                              setEodByBlock((prev) => ({ ...prev, [block._id]: { ...eodState, delay_reason: e.target.value } }))
                            }
                            placeholder="Reason for delay (if any)"
                          />
                          <button className="mini-btn save" onClick={() => submitEod(block)}>Save EOD</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HourlyTaskBreakdown;
