import { useState, useEffect } from "react";
import api from "../services/api";

interface TaskChatProps {
  taskId: string;
  token: string;
  currentEmail: string;
}

interface ChatMessage {
  user_email: string;
  message: string;
  timestamp: string;
}

export default function TaskChat({ taskId, token, currentEmail }: TaskChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [taskData, setTaskData] = useState<any>(null);

  useEffect(() => {
    fetchTaskDetail();
    // Auto-refresh chat every 3 seconds
    const interval = setInterval(fetchTaskDetail, 3000);
    return () => clearInterval(interval);
  }, [taskId]);

  const fetchTaskDetail = async () => {
    try {
      const response = await api.get(`/reports/task/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTaskData(response.data);
      setMessages(response.data.chat || []);
    } catch (err) {
      console.error("Failed to fetch task:", err);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setLoading(true);
      await api.post(
        `/reports/task/${taskId}/chat`,
        { task_id: taskId, message: newMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewMessage("");
      await fetchTaskDetail();
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#f5f5f5", borderRadius: 8, padding: 20 }}>
      <h4 style={{ marginTop: 0 }}>💬 Team Chat</h4>

      <div
        style={{
          backgroundColor: "white",
          border: "1px solid #ddd",
          borderRadius: 4,
          padding: 15,
          height: 300,
          overflowY: "auto",
          marginBottom: 15
        }}
      >
        {messages.length === 0 ? (
          <p style={{ color: "#999", textAlign: "center" }}>No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: 10,
                backgroundColor: msg.user_email === currentEmail ? "#e3f2fd" : "#f5f5f5",
                padding: 10,
                borderRadius: 4
              }}
            >
              <p style={{ margin: "0 0 5px 0", fontSize: 12, fontWeight: "bold", color: "#007bff" }}>
                {msg.user_email}
              </p>
              <p style={{ margin: 0, color: "#333" }}>{msg.message}</p>
              <p style={{ margin: "5px 0 0 0", fontSize: 10, color: "#999" }}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <input
          type="text"
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 4,
            border: "1px solid #ddd"
          }}
        />
        <button
          onClick={handleSendMessage}
          disabled={loading}
          style={{
            padding: 10,
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer"
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
