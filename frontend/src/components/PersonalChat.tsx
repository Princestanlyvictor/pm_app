import { useEffect, useState, useRef } from "react";
import api from "../services/api";

interface PersonalChatProps {
  token: string;
  currentUserId: string;
  currentEmail: string;
}

interface ChatUser {
  id: string;
  email: string;
  role: string;
}

interface DMMessage {
  id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  receiver_id: string;
  message: string;
  created_at: string;
}

export default function PersonalChat({ token, currentUserId, currentEmail }: PersonalChatProps) {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchUsers = async () => {
    try {
      const res = await api.get("/chat/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const others = res.data.filter((u: ChatUser) => u.id !== currentUserId);
      setUsers(others);
      if (!selectedUser && others.length > 0) {
        setSelectedUser(others[0]);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  const fetchMessages = async (participantId: string) => {
    try {
      const res = await api.get("/chat/dm/messages", {
        params: { participant_id: participantId },
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      console.error("Failed to fetch DM messages", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.id);
      const interval = setInterval(() => fetchMessages(selectedUser.id), 4000);
      return () => clearInterval(interval);
    }
  }, [selectedUser?.id]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    try {
      setLoading(true);
      await api.post(
        "/chat/dm/messages",
        { receiver_id: selectedUser.id, message: newMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewMessage("");
      await fetchMessages(selectedUser.id);
    } catch (err) {
      console.error("Failed to send DM", err);
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
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, height: "400px" }}>
      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, backgroundColor: "#fafafa", overflowY: "auto" }}>
        <h4 style={{ margin: "0 0 10px 0" }}>People</h4>
        {users.length === 0 && <p style={{ color: "#888" }}>No other users yet.</p>}
        {users.map((u) => (
          <div
            key={u.id}
            onClick={() => setSelectedUser(u)}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              backgroundColor: selectedUser?.id === u.id ? "#e3f2fd" : "white",
              marginBottom: 6,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1px solid #eee",
              cursor: "pointer"
            }}
          >
            <span style={{ fontSize: 14 }}>{u.email}</span>
            <span style={{ backgroundColor: badgeColor(u.role), color: "white", padding: "2px 8px", borderRadius: 12, fontSize: 11, textTransform: "capitalize" }}>
              {u.role.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, display: "flex", flexDirection: "column", backgroundColor: "#fff" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Direct Message</span>
          <span style={{ color: "#666", fontSize: 12 }}>
            {selectedUser ? selectedUser.email : "Select a person"}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 12, backgroundColor: "#f7f7f7" }}>
          {!selectedUser ? (
            <p style={{ color: "#888", textAlign: "center" }}>Pick someone to chat.</p>
          ) : messages.length === 0 ? (
            <p style={{ color: "#888", textAlign: "center" }}>No messages yet. Say hello!</p>
          ) : (
            messages.map((m) => {
              const isMine = m.user_email === currentEmail;
              return (
                <div
                  key={m.id}
                  style={{ marginBottom: 10, display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start" }}
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
                      backgroundColor: isMine ? "#dbeafe" : "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: 10,
                      maxWidth: "70%",
                    }}
                  >
                    {m.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: 12, borderTop: "1px solid #eee", display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder={selectedUser ? `Message ${selectedUser.email}` : "Select a person to chat"}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={!selectedUser}
            style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #ddd" }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !selectedUser}
            style={{ padding: "10px 16px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: 6, cursor: selectedUser ? "pointer" : "not-allowed" }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
