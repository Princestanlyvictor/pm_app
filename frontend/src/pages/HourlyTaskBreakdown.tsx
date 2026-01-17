import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import '../styles/HourlyTaskBreakdown.css';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  estimated_time?: number;
  scheduled_start_time: string;  // HH:MM format
  scheduled_end_time: string;    // HH:MM format
  duration_minutes?: number;
  duration_hours?: number;
}

interface HourSlot {
  hour: number;
  time_slot: string;
  tasks: Task[];
}

interface HourlyTaskBreakdownProps {
  onNavigateToTeamMemberDashboard?: () => void;
  onNavigateToProjects?: () => void;
}

interface ProjectType {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
}

const HourlyTaskBreakdown: React.FC<HourlyTaskBreakdownProps> = ({
  onNavigateToTeamMemberDashboard,
  onNavigateToProjects,
}) => {
  const { token } = useContext(AuthContext);
  const [hourlyData, setHourlyData] = useState<HourSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [projects, setProjects] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [startHour, setStartHour] = useState<number>(0);
  const [endHour, setEndHour] = useState<number>(24);

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const response = await api.get('/projects', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(response.data);
      if (response.data.length > 0) {
        setSelectedProject(response.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  }, [token]);

  // Fetch hourly breakdown
  const fetchHourlyBreakdown = useCallback(async () => {
    if (!selectedProject) return;

    setLoading(true);
    try {
      const response = await api.get(
        `/reports/tasks/hourly-breakdown/${selectedProject}?date=${selectedDate}&start_hour=${startHour}&end_hour=${endHour}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHourlyData(response.data);
    } catch (error) {
      console.error('Error fetching hourly breakdown:', error);
      setHourlyData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProject, selectedDate, startHour, endHour, token]);

  // Mark task as complete
  const markTaskComplete = async (taskId: string) => {
    setCompletingTaskId(taskId);
    try {
      await api.put(`/reports/task/${taskId}/complete`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Refresh the data after marking complete
      await fetchHourlyBreakdown();
    } catch (error) {
      console.error('Error marking task as complete:', error);
    } finally {
      setCompletingTaskId(null);
    }
  };

  // Move incomplete tasks to next day (end of day action)
  const moveIncompleteTasks = async () => {
    try {
      const response = await api.post(
        `/reports/tasks/move-incomplete-to-next-day`,
        { date: selectedDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`${response.data.tasks_moved} tasks moved to ${response.data.next_day} as pending`);
      // Refresh the breakdown after moving tasks
      await fetchHourlyBreakdown();
    } catch (error) {
      console.error('Error moving incomplete tasks:', error);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (selectedProject) {
      fetchHourlyBreakdown();
    }
  }, [selectedDate, selectedProject, startHour, endHour, fetchHourlyBreakdown]);

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'High':
        return '#e74c3c';
      case 'Medium':
        return '#f39c12';
      case 'Low':
        return '#27ae60';
      default:
        return '#95a5a6';
    }
  };

  const getStatusBgColor = (status: string): string => {
    switch (status) {
      case 'Done':
        return '#d5f4e6';
      case 'In Progress':
        return '#fef5e7';
      case 'Pending':
        return '#fadbd8';
      default:
        return '#ecf0f1';
    }
  };

  const totalTasks = hourlyData.reduce((sum, slot) => sum + slot.tasks.length, 0);
  const completedTasks = hourlyData.reduce(
    (sum, slot) =>
      sum + slot.tasks.filter((task) => task.status === 'Done').length,
    0
  );

  return (
    <div className="hourly-task-breakdown">
      {/* Header */}
      <div className="htb-header">
        <div className="htb-header-top">
          <h1>📅 Daily Task Breakdown</h1>
          <div className="htb-nav-buttons">
            {onNavigateToTeamMemberDashboard && (
              <button
                className="nav-btn secondary"
                onClick={onNavigateToTeamMemberDashboard}
              >
                ← Back to Dashboard
              </button>
            )}
            {onNavigateToProjects && (
              <button
                className="nav-btn secondary"
                onClick={onNavigateToProjects}
              >
                📁 Projects
              </button>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="htb-controls">
          <div className="control-group">
            <label htmlFor="project-select">Select Project:</label>
            <select
              id="project-select"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="htb-select"
            >
              <option value="">-- Select a project --</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="date-picker">Select Date:</label>
            <input
              id="date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="htb-input"
            />
          </div>

          <div className="control-group">
            <label htmlFor="start-hour">Start Hour:</label>
            <select
              id="start-hour"
              value={startHour}
              onChange={(e) => {
                const newStart = parseInt(e.target.value);
                if (newStart < endHour) {
                  setStartHour(newStart);
                }
              }}
              className="htb-select"
            >
              {Array.from({ length: 24 }, (_, i) => {
                const display = i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`;
                return (
                  <option key={i} value={i}>
                    {display}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="end-hour">End Hour:</label>
            <select
              id="end-hour"
              value={endHour}
              onChange={(e) => {
                const newEnd = parseInt(e.target.value);
                if (newEnd > startHour) {
                  setEndHour(newEnd);
                }
              }}
              className="htb-select"
            >
              {Array.from({ length: 25 }, (_, i) => {
                const display = i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`;
                return (
                  <option key={i} value={i}>
                    {display}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="control-group">
            <button
              className="nav-btn primary"
              onClick={() => setSelectedDate(getTodayDate())}
            >
              Today
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="htb-summary">
          <div className="summary-stat">
            <span className="stat-label">Total Tasks:</span>
            <span className="stat-value">{totalTasks}</span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">Completed:</span>
            <span className="stat-value" style={{ color: '#27ae60' }}>
              {completedTasks}
            </span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">Remaining:</span>
            <span className="stat-value" style={{ color: '#e74c3c' }}>
              {totalTasks - completedTasks}
            </span>
          </div>
        </div>
      </div>

      {/* Hourly Breakdown */}
      <div className="htb-content">
        {loading ? (
          <div className="loading-spinner">Loading tasks...</div>
        ) : hourlyData.length === 0 ? (
          <div className="empty-state">
            <p>No data available for this project and date</p>
          </div>
        ) : (
          <div className="hourly-grid">
            {hourlyData.map((slot) => (
              <div key={slot.hour} className="hour-slot">
                <div className="hour-header">
                  <h3>{slot.time_slot}</h3>
                  <span className="task-count">{slot.tasks.length} tasks</span>
                </div>

                <div className="hour-tasks">
                  {slot.tasks.length > 0 ? (
                    slot.tasks.map((task) => {
                      const isMultiHour = task.duration_hours && task.duration_hours > 1;
                      return (
                        <div
                          key={task.id}
                          className={`task-card ${task.status === 'Done' ? 'completed' : ''} ${isMultiHour ? 'multi-hour' : ''}`}
                          style={{ backgroundColor: getStatusBgColor(task.status) }}
                        >
                          <div className="task-header">
                            <div>
                              <h4>
                                {task.title}
                                {isMultiHour && (
                                  <span className="task-duration-badge">
                                    {task.duration_hours ? task.duration_hours.toFixed(1) : '?'}h
                                  </span>
                                )}
                              </h4>
                              {task.scheduled_start_time && task.scheduled_end_time && (
                                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#7f8c8d' }}>
                                  {task.scheduled_start_time} - {task.scheduled_end_time}
                                </p>
                              )}
                            </div>
                            <span
                              className="priority-badge"
                              style={{ backgroundColor: getPriorityColor(task.priority) }}
                            >
                              {task.priority}
                            </span>
                          </div>

                          {task.description && (
                            <p className="task-description">{task.description}</p>
                          )}

                          <div className="task-meta">
                            {task.estimated_time && (
                              <span className="meta-item">
                                ⏱️ {task.estimated_time}h
                              </span>
                            )}
                            <span className="meta-item status">
                              {task.status === 'Done' ? '✅' : '⏳'} {task.status}
                            </span>
                          </div>

                          {task.status !== 'Done' && (
                            <button
                              className="complete-btn"
                              onClick={() => markTaskComplete(task.id)}
                              disabled={completingTaskId === task.id}
                            >
                              {completingTaskId === task.id ? 'Marking...' : '✓ Mark Complete'}
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="no-tasks">No tasks scheduled</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* End of Day Actions */}
      <div className="htb-footer">
        {selectedDate < getTodayDate() ? (
          <p className="footer-info">Past date - no end of day actions available</p>
        ) : selectedDate === getTodayDate() ? (
          <button
            className="end-of-day-btn"
            onClick={moveIncompleteTasks}
            disabled={totalTasks - completedTasks === 0}
          >
            📌 Move Incomplete Tasks to Tomorrow
          </button>
        ) : (
          <p className="footer-info">Future date - tasks will be moved on that day</p>
        )}
      </div>
    </div>
  );
};

export default HourlyTaskBreakdown;
