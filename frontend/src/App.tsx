import { useContext, useState } from "react";
import { AuthContext } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ProjectManagerDashboard from "./pages/ProjectManagerDashboard";
import TeamMemberDashboard from "./pages/TeamMemberDashboard";
import ChatPage from "./pages/ChatPage";
import KanbanBoard from "./pages/KanbanBoard";
import ProjectsPage from "./pages/ProjectsPage";
import TeamMembersPage from "./pages/TeamMembersPage";
import HourlyTaskBreakdown from "./pages/HourlyTaskBreakdown";

function App() {
  const { isAuthenticated, user } = useContext(AuthContext);
  const [showLogin, setShowLogin] = useState(true);
  const [currentPage, setCurrentPage] = useState<"dashboard" | "chat" | "kanban" | "projects" | "team-members" | "hourly-breakdown">("dashboard");

  if (isAuthenticated && user) {
    if (currentPage === "chat") {
      return <ChatPage onNavigateBack={() => setCurrentPage("dashboard")} />;
    }

    if (currentPage === "kanban") {
      return (
        <KanbanBoard
          onNavigateBack={() => setCurrentPage("dashboard")}
          onNavigateToChat={() => setCurrentPage("chat")}
        />
      );
    }

    if (currentPage === "projects") {
      return <ProjectsPage onNavigateBack={() => setCurrentPage("dashboard")} />;
    }

    if (currentPage === "team-members") {
      return <TeamMembersPage onNavigateBack={() => setCurrentPage("dashboard")} />;
    }

    if (currentPage === "hourly-breakdown") {
      return (
        <HourlyTaskBreakdown
          onNavigateToTeamMemberDashboard={() => setCurrentPage("dashboard")}
          onNavigateToProjects={() => setCurrentPage("projects")}
        />
      );
    }

    if (user.role === "project_manager") {
      return (
        <ProjectManagerDashboard
          onNavigateToChat={() => setCurrentPage("chat")}
          onNavigateToKanban={() => setCurrentPage("kanban")}
          onNavigateToProjects={() => setCurrentPage("projects")}
          onNavigateToTeamMembers={() => setCurrentPage("team-members")}
        />
      );
    } else if (user.role === "team_member") {
      return (
        <TeamMemberDashboard
          onNavigateToChat={() => setCurrentPage("chat")}
          onNavigateToKanban={() => setCurrentPage("kanban")}
          onNavigateToProjects={() => setCurrentPage("projects")}
          onNavigateToHourlyBreakdown={() => setCurrentPage("hourly-breakdown")}
        />
      );
    } else {
      // Default dashboard for other roles
      return <Dashboard />;
    }
  }

  return (
    <div className="auth-layout">
      {showLogin ? (
        <Login switchToRegister={() => setShowLogin(false)} />
      ) : (
        <Register switchToLogin={() => setShowLogin(true)} />
      )}
    </div>
  );
}

export default App;
