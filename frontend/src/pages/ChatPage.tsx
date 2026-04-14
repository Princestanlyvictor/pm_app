import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import GlobalChat from "../components/GlobalChat";
import PersonalChat from "../components/PersonalChat";

interface ChatPageProps {
  onNavigateBack?: () => void;
}

export default function ChatPage({ onNavigateBack }: ChatPageProps) {
  const { user, token, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState<"global" | "personal">("global");

  return (
    <div style={{ padding: 40, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <h1> Chat</h1>
        <div style={{ display: "flex", gap: 10 }}>
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              style={{
                padding: "10px 20px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              Back Back to Dashboard
            </button>
          )}
          <button
            onClick={logout}
            style={{
              padding: "10px 20px",
              backgroundColor: "#ff6b6b",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: "#f0f0f0", padding: 20, borderRadius: 8, marginBottom: 30 }}>
        <p><strong>Logged in as:</strong> {user?.email}</p>
        <p><strong>Role:</strong> {user?.role}</p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab("global")}
          style={{
            padding: "12px 30px",
            backgroundColor: activeTab === "global" ? "#007bff" : "#e9ecef",
            color: activeTab === "global" ? "white" : "#495057",
            border: "none",
            borderRadius: "8px 8px 0 0",
            cursor: "pointer",
            marginRight: 5,
            fontWeight: activeTab === "global" ? "bold" : "normal"
          }}
        >
           Global Chat
        </button>
        <button
          onClick={() => setActiveTab("personal")}
          style={{
            padding: "12px 30px",
            backgroundColor: activeTab === "personal" ? "#007bff" : "#e9ecef",
            color: activeTab === "personal" ? "white" : "#495057",
            border: "none",
            borderRadius: "8px 8px 0 0",
            cursor: "pointer",
            fontWeight: activeTab === "personal" ? "bold" : "normal"
          }}
        >
           Personal Chat
        </button>
      </div>

      <div style={{ backgroundColor: "white", padding: 30, borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        {activeTab === "global" && token && user?.email && (
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 20 }}>Global Team Chat</h3>
            <p style={{ color: "#666", marginBottom: 20 }}>Chat with all team members and project managers</p>
            <GlobalChat token={token} currentEmail={user.email} currentRole={user.role} />
          </div>
        )}

        {activeTab === "personal" && token && user?.email && user?.id && (
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 20 }}>Personal Conversations</h3>
            <p style={{ color: "#666", marginBottom: 20 }}>Private one-on-one chat with team members</p>
            <PersonalChat token={token} currentEmail={user.email} currentUserId={user.id} />
          </div>
        )}
      </div>
    </div>
  );
}
