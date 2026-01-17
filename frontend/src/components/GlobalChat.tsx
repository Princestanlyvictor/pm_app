import { useEffect, useState, useRef } from "react";
import api from "../services/api";

interface GlobalChatProps {
  token: string;
  currentEmail: string;
  currentRole: string;
}

interface ChatMessage {
  id: string;
  user_email: string;
  user_role: string;
  message: string;
  created_at: string;
}

interface ChatUser {
  id: string;
  email: string;
  role: string;
}

export default function GlobalChat({ token, currentEmail, currentRole }: GlobalChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await api.get("/chat/messages", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get("/chat/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchUsers();
    const interval = setInterval(fetchMessages, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    try {
      setLoading(true);
      await api.post(
        "/chat/messages",
        { message: newMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewMessage("");
      await fetchMessages();
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setLoading(false);
    }
  };

  const badgeColor = (role: string) => {
    if (role === "project_manager") return "#ff6b6b";
    if (role === "team_member") return "#6bcf7f";
    return "#6c757d";
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, height: "420px" }}>
      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, backgroundColor: "#fafafa", overflowY: "auto" }}>
        <h4 style={{ margin: "0 0 10px 0" }}>Team</h4>
        {users.map((u) => (
          <div key={u.id} style={{ padding: "8px 10px", borderRadius: 6, backgroundColor: u.email === currentEmail ? "#e3f2fd" : "white", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #eee" }}>
            <span style={{ fontSize: 14 }}>{u.email}</span>
            <span style={{ backgroundColor: badgeColor(u.role), color: "white", padding: "2px 8px", borderRadius: 12, fontSize: 11, textTransform: "capitalize" }}>
              {u.role.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, display: "flex", flexDirection: "column", backgroundColor: "#fff" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Global Chat</span>
          <span style={{ color: "#666", fontSize: 12 }}>Everyone (PM + Team)</span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 12, backgroundColor: "#f7f7f7" }}>
          {messages.length === 0 ? (
            <p style={{ color: "#888", textAlign: "center" }}>No messages yet. Start the conversation.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                style={{
                  marginBottom: 10,
                  alignSelf: m.user_email === currentEmail ? "flex-end" : "flex-start",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: "#007bff" }}>{m.user_email}</span>
                  <span style={{ backgroundColor: badgeColor(m.user_role), color: "white", padding: "2px 8px", borderRadius: 12, fontSize: 11 }}>
                    {m.user_role?.replace("_", " ") || "member"}
                  </span>
                  <span style={{ fontSize: 11, color: "#999" }}>
                    {m.created_at ? new Date(m.created_at).toLocaleTimeString() : ""}
                  </span>
                </div>
                <div
                  style={{
                    backgroundColor: m.user_email === currentEmail ? "#dbeafe" : "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: 10,
                    maxWidth: "70%",
                  }}
                >
                  {m.message}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: 12, borderTop: "1px solid #eee", display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Message the whole team..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #ddd" }}
          />
          <button
            onClick={handleSend}
            disabled={loading}
            style={{ padding: "10px 16px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
