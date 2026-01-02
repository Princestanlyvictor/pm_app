import { useContext, useState } from "react";
import { AuthContext } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ProjectManagerDashboard from "./pages/ProjectManagerDashboard";
import TeamMemberDashboard from "./pages/TeamMemberDashboard";
import ChatPage from "./pages/ChatPage";
import KanbanBoard from "./pages/KanbanBoard";

function App() {
  const { isAuthenticated, user } = useContext(AuthContext);
  const [showLogin, setShowLogin] = useState(true);
  const [currentPage, setCurrentPage] = useState<"dashboard" | "chat" | "kanban">("dashboard");

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

    if (user.role === "project_manager") {
      return (
        <ProjectManagerDashboard
          onNavigateToChat={() => setCurrentPage("chat")}
          onNavigateToKanban={() => setCurrentPage("kanban")}
        />
      );
    } else if (user.role === "team_member") {
      return (
        <TeamMemberDashboard
          onNavigateToChat={() => setCurrentPage("chat")}
          onNavigateToKanban={() => setCurrentPage("kanban")}
        />
      );
    } else {
      // Default dashboard for other roles
      return <Dashboard />;
    }
  }

  return (
    <div style={{ padding: 40 }}>
      {showLogin ? (
        <Login switchToRegister={() => setShowLogin(false)} />
      ) : (
        <Register switchToLogin={() => setShowLogin(true)} />
      )}
    </div>
  );
}

export default App;
