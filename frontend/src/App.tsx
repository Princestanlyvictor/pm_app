import { useContext, useState } from "react";
import type { ReactElement } from "react";
import { AuthContext } from "./context/AuthContext";
import "./App.css";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ProjectManagerDashboard from "./pages/ProjectManagerDashboard";
import TeamMemberDashboard from "./pages/TeamMemberDashboard";
import ChatPage from "./pages/ChatPage";
import KanbanBoard from "./pages/KanbanBoard";
import ProjectsPage from "./pages/ProjectsPage";
import TeamMembersPage from "./pages/TeamMembersPage";
import TaskManagement from "./pages/TaskManagement";

function App() {
  const { isAuthenticated, user, logout } = useContext(AuthContext);
  const [showLogin, setShowLogin] = useState(true);
  const [currentPage, setCurrentPage] = useState<"dashboard" | "chat" | "kanban" | "projects" | "team-members" | "hourly-breakdown" | "tm-dependencies" | "tm-overall-tasks">("dashboard");
  const isAdmin = user?.role === "admin" || user?.role === "project_manager";
  const isTeamMember = user?.role === "team_member" || user?.role === "user" || user?.role === "member";
  if (isAuthenticated && user) {
    let currentView: ReactElement;

    if (currentPage === "chat") {
      currentView = <ChatPage onNavigateBack={() => setCurrentPage("dashboard")} />;
    } else if (currentPage === "kanban") {
      currentView = (
        <KanbanBoard
          onNavigateBack={() => setCurrentPage("dashboard")}
          onNavigateToChat={() => setCurrentPage("chat")}
        />
      );
    } else if (currentPage === "projects") {
      currentView = <ProjectsPage onNavigateBack={() => setCurrentPage("dashboard")} />;
    } else if (currentPage === "team-members") {
      currentView = <TeamMembersPage onNavigateBack={() => setCurrentPage("dashboard")} />;
    } else if (currentPage === "hourly-breakdown") {
      currentView = (
        <TaskManagement
          onNavigateToTeamMemberDashboard={() => setCurrentPage("dashboard")}
          onNavigateToProjects={() => setCurrentPage("projects")}
          onNavigateToKanban={() => setCurrentPage("kanban")}
        />
      );
    } else if (isAdmin) {
      currentView = (
        <ProjectManagerDashboard
          onNavigateToChat={() => setCurrentPage("chat")}
          onNavigateToKanban={() => setCurrentPage("kanban")}
          onNavigateToProjects={() => setCurrentPage("projects")}
          onNavigateToTeamMembers={() => setCurrentPage("team-members")}
        />
      );
    } else if (isTeamMember) {
      const teamMemberInitialView =
        currentPage === "tm-dependencies"
          ? "dependencies"
          : currentPage === "tm-overall-tasks"
            ? "overall-tasks"
            : "home";

      currentView = (
        <TeamMemberDashboard
          showSidebar={false}
          initialView={teamMemberInitialView}
          onNavigateToChat={() => setCurrentPage("chat")}
          onNavigateToKanban={() => setCurrentPage("kanban")}
          onNavigateToProjects={() => setCurrentPage("projects")}
          onNavigateToHourlyBreakdown={() => setCurrentPage("hourly-breakdown")}
        />
      );
    } else {
      currentView = <Dashboard />;
    }

    return (
      <div className="app-auth-shell">
        <aside className="app-auth-sidebar">
          <div className="app-auth-brand">PM Workspace</div>
          <nav className="app-auth-nav">
            <button className={`app-auth-nav-item ${currentPage === "dashboard" ? "active" : ""}`} onClick={() => setCurrentPage("dashboard")}>Dashboard</button>
            {isTeamMember && (
              <button className={`app-auth-nav-item ${currentPage === "hourly-breakdown" ? "active" : ""}`} onClick={() => setCurrentPage("hourly-breakdown")}>Task Management</button>
            )}
            {isTeamMember && (
              <button className={`app-auth-nav-item ${currentPage === "tm-overall-tasks" ? "active" : ""}`} onClick={() => setCurrentPage("tm-overall-tasks")}>Overall Tasks</button>
            )}
            <button className={`app-auth-nav-item ${currentPage === "projects" ? "active" : ""}`} onClick={() => setCurrentPage("projects")}>Projects</button>
            {isTeamMember && (
              <button className={`app-auth-nav-item ${currentPage === "tm-dependencies" ? "active" : ""}`} onClick={() => setCurrentPage("tm-dependencies")}>Dependencies</button>
            )}
            <button className={`app-auth-nav-item ${currentPage === "chat" ? "active" : ""}`} onClick={() => setCurrentPage("chat")}>Chat</button>
            {isAdmin && (
              <button className={`app-auth-nav-item ${currentPage === "team-members" ? "active" : ""}`} onClick={() => setCurrentPage("team-members")}>Team Members</button>
            )}
          </nav>
          <button className="app-auth-logout" onClick={logout}>Logout</button>
        </aside>

        <main className="app-auth-main">{currentView}</main>
      </div>
    );
  }

  return (
    <div className="auth-layout">
      <div className="auth-shell">
        <aside className="auth-sidebar">
          <h1>PM Workspace</h1>
          <p>Modern SaaS authentication for Admin and User access with secure onboarding.</p>

          <div className="auth-sidebar-nav">
            <button
              className={`auth-sidebar-item ${showLogin ? "active" : ""}`}
              type="button"
              onClick={() => setShowLogin(true)}
            >
              <span></span>
              <span>Sign in</span>
            </button>
            <button
              className={`auth-sidebar-item ${!showLogin ? "active" : ""}`}
              type="button"
              onClick={() => setShowLogin(false)}
            >
              <span></span>
              <span>Create account</span>
            </button>
          </div>

          <small>Clean - Professional - Enterprise</small>
        </aside>

        <section className="auth-main-panel">
          {showLogin ? (
            <Login switchToRegister={() => setShowLogin(false)} />
          ) : (
            <Register switchToLogin={() => setShowLogin(true)} />
          )}
        </section>
      </div>
    </div>
  );
}

export default App;
