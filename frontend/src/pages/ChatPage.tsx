import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import GlobalChat from "../components/GlobalChat";
import PersonalChat from "../components/PersonalChat";
import "../styles/TeamChat.css";

interface ChatPageProps {
  onNavigateBack?: () => void;
}

export default function ChatPage(_: ChatPageProps) {
  const { user, token } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState<"global" | "personal">("global");

  return (
    <div className="team-chat-page">
      <section className="team-chat-main">
        <header className="team-chat-header">
          <h1>Team Chat</h1>
          <p>Collaborate with your team through global channels and focused direct conversations.</p>
        </header>

        <div className="team-chat-tabs" role="tablist" aria-label="Chat types">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "global"}
            className={`team-chat-tab ${activeTab === "global" ? "active" : ""}`}
            onClick={() => setActiveTab("global")}
          >
            Global Chat
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "personal"}
            className={`team-chat-tab ${activeTab === "personal" ? "active" : ""}`}
            onClick={() => setActiveTab("personal")}
          >
            Personal Chat
          </button>
        </div>

        <div className="team-chat-panel">
          {activeTab === "global" && token && user?.email && (
            <GlobalChat token={token} currentEmail={user.email} />
          )}

          {activeTab === "personal" && token && user?.email && user?.id && (
            <PersonalChat token={token} currentEmail={user.email} currentUserId={user.id} />
          )}
        </div>
      </section>
    </div>
  );
}
