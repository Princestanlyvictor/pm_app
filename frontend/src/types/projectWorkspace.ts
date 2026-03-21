export type ProjectStatus = "Active" | "On Hold" | "Completed";

export interface ProjectMember {
  email: string;
  role: "project_manager" | "developer" | "viewer";
  added_at?: string;
  added_by?: string;
  workload?: number;
}

export interface WorkspaceProjectSummary {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  start_date?: string;
  end_date?: string;
  project_manager_email?: string;
}

export interface WorkspaceStats {
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  overdue_tasks: number;
  blocked_tasks: number;
  progress_percent: number;
}

export interface WorkspaceActivity {
  _id?: string;
  project_id: string;
  action: string;
  message: string;
  actor_email?: string;
  actor_role?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface WorkspaceBlockedTask {
  id: string;
  title: string;
  unresolved_dependencies: string[];
}

export interface WorkspacePayload {
  project: WorkspaceProjectSummary;
  user_project_role: "project_manager" | "developer" | "viewer";
  stats: WorkspaceStats;
  members: ProjectMember[];
  workload_distribution: Array<{ email: string; task_count: number }>;
  blocked_tasks: WorkspaceBlockedTask[];
  recent_activity: WorkspaceActivity[];
}

export interface WorkspaceTask {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  stage?: string;
  task_date: string;
  due_date?: string;
  estimated_time?: number;
  dependencies: string[];
  resolved_dependencies: string[];
  assigned_to: string[];
  created_by: string;
  updated_at?: string;
}

export interface WorkspaceTaskResponse {
  view: "list" | "kanban";
  items: WorkspaceTask[] | Record<string, WorkspaceTask[]>;
}

export interface RoadmapStage {
  id: string;
  name: string;
  description?: string;
  order: number;
  task_count?: number;
  completed_count?: number;
  progress_percent?: number;
}

export interface RoadmapMilestone {
  id: string;
  name: string;
  stage_id?: string;
  deadline?: string;
  description?: string;
  status: "planned" | "in_progress" | "completed";
}

export interface RoadmapPayload {
  stages: RoadmapStage[];
  milestones: RoadmapMilestone[];
}

export interface ProjectDoc {
  _id?: string;
  project_id: string;
  title: string;
  content: string;
  version: string;
  last_updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface RepositoryPayload {
  repo_url: string;
  default_branch: string;
  updated_at?: string;
  updated_by?: string;
}
