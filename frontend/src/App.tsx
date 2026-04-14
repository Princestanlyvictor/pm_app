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
import AppHeader from "./components/AppHeader";

function App() {
  const { isAuthenticated, user } = useContext(AuthContext);
  const [showLogin, setShowLogin] = useState(true);
  const [currentPage, setCurrentPage] = useState<"dashboard" | "chat" | "kanban" | "projects" | "team-members" | "hourly-breakdown">("dashboard");
  const isAdmin = user?.role === "admin" || user?.role === "project_manager";
  const isTeamMember = user?.role === "team_member" || user?.role === "user" || user?.role === "member";
  const pageTitles: Record<string, string> = {
    dashboard: "Dashboard",
    chat: "Chat",
    kanban: "Kanban",
    projects: "Projects",
    "team-members": "Team Members",
    "hourly-breakdown": "Task Management",
  };

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
      currentView = (
        <TeamMemberDashboard
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
      <div style={{ minHeight: "100vh", backgroundColor: "#F5F6FA" }}>
        <AppHeader
          user={user}
          pageTitle={pageTitles[currentPage] || "Workspace"}
          showDashboardButton={currentPage !== "dashboard"}
          onGoDashboard={() => setCurrentPage("dashboard")}
        />
        <main>{currentView}</main>
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
              <span>🔐</span>
              <span>Sign in</span>
            </button>
            <button
              className={`auth-sidebar-item ${!showLogin ? "active" : ""}`}
              type="button"
              onClick={() => setShowLogin(false)}
            >
              <span>👤</span>
              <span>Create account</span>
            </button>
          </div>

          <small>Clean · Professional · Enterprise</small>
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
