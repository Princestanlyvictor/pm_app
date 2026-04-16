import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";

interface GlobalChatProps {
  token: string;
  currentEmail: string;
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

export default function GlobalChat({ token, currentEmail }: GlobalChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [search, setSearch] = useState("");
  const [showMembers, setShowMembers] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const [loading, setLoading] = useState(false);

  const messageListRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const roleLabel = (role: string) => {
    if (role === "project_manager") return "PM";
    if (role === "team_member") return "Team Member";
    if (role === "admin") return "Admin";
    return "Member";
  };

  const avatarText = (email: string) => {
    const base = email.split("@")[0].replace(/[^a-zA-Z0-9]+/g, " ").trim();
    const chunks = base.split(" ").filter(Boolean);
    if (chunks.length >= 2) {
      return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
    }
    return base.slice(0, 2).toUpperCase() || "U";
  };

  const badgeColorClass = (role: string) => {
    if (role === "project_manager") return "role-pm";
    if (role === "team_member") return "role-member";
    if (role === "admin") return "role-admin";
    return "role-default";
  };

  const getDateLabel = (isoDate: string) => {
    if (!isoDate) return "Unknown";
    const date = new Date(isoDate);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    if (isSameDay(date, today)) return "Today";
    if (isSameDay(date, yesterday)) return "Yesterday";
    return date.toLocaleDateString();
  };

  const scrollToLatest = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const updateScrollState = useCallback(() => {
    const container = messageListRef.current;
    if (!container) return;
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 52;
    setAtBottom(nearBottom);
    if (nearBottom) {
      setUnreadCount(0);
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get("/chat/messages", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const incoming = (res.data || []) as ChatMessage[];

      setMessages((previous) => {
        const newCount = Math.max(incoming.length - previous.length, 0);
        if (newCount > 0 && !atBottom) {
          setUnreadCount((count) => count + newCount);
        }
        return incoming;
      });

      if (atBottom) {
        setTimeout(scrollToLatest, 40);
      }
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  }, [token, atBottom, scrollToLatest]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get("/chat/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers((res.data || []) as ChatUser[]);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  }, [token]);

  useEffect(() => {
    fetchMessages();
    fetchUsers();
    const interval = setInterval(fetchMessages, 4000);
    return () => clearInterval(interval);
  }, [fetchMessages, fetchUsers]);

  useEffect(() => {
    const container = messageListRef.current;
    if (!container) return;
    container.addEventListener("scroll", updateScrollState);
    return () => container.removeEventListener("scroll", updateScrollState);
  }, [updateScrollState]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    try {
      setLoading(true);
      await api.post(
        "/chat/messages",
        { message: newMessage.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewMessage("");
      setIsTyping(false);
      await fetchMessages();
      setTimeout(scrollToLatest, 30);
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    setIsTyping(value.trim().length > 0);
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => setIsTyping(false), 1200);
  };

  const handleReply = (email: string) => {
    setNewMessage((prev) => `@${email} ${prev}`.trimStart());
  };

  const handleCopy = async (message: string) => {
    try {
      await navigator.clipboard.writeText(message);
    } catch (err) {
      console.error("Failed to copy message", err);
    }
  };

  const onlineUsers = useMemo(() => {
    const now = Date.now();
    const set = new Set<string>();
    messages.forEach((item) => {
      const createdAt = new Date(item.created_at).getTime();
      if (now - createdAt <= 10 * 60 * 1000) {
        set.add(item.user_email);
      }
    });
    return set;
  }, [messages]);

  const filteredUsers = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return users;
    return users.filter((user) => user.email.toLowerCase().includes(query));
  }, [search, users]);

  let lastLabel = "";
  const chatRows = messages.map((message) => {
    const groupLabel = getDateLabel(message.created_at);
    const showDateGroup = groupLabel !== lastLabel;
    lastLabel = groupLabel;
    return { message, groupLabel, showDateGroup };
  });

  const canSend = Boolean(newMessage.trim()) && !loading;

  return (
    <div className="chat-layout">
      <aside className={`chat-people-panel ${showMembers ? "open" : ""}`}>
        <div className="chat-panel-header">
          <h4>Team Members</h4>
          <span>{users.length}</span>
        </div>

        <div className="chat-user-search-wrap">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="chat-user-search"
            placeholder="Search teammates"
            aria-label="Search teammates"
          />
        </div>

        <div className="chat-user-list">
          {filteredUsers.map((user) => {
            const isCurrent = user.email === currentEmail;
            return (
              <div key={user.id} className={`chat-user-item ${isCurrent ? "is-current" : ""}`}>
                <div className="chat-user-avatar" aria-hidden="true">{avatarText(user.email)}</div>
                <div className="chat-user-meta">
                  <div className="chat-user-top-row">
                    <span className="chat-user-email">{user.email}</span>
                    <span className={`chat-role-pill ${badgeColorClass(user.role)}`}>{roleLabel(user.role)}</span>
                  </div>
                  <div className="chat-user-status-row">
                    <span className={`status-dot ${onlineUsers.has(user.email) ? "online" : "offline"}`} />
                    <span>{onlineUsers.has(user.email) ? "Online" : "Offline"}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredUsers.length === 0 && <p className="chat-empty-note">No users match your search.</p>}
        </div>
      </aside>

      <section className="chat-conversation-card">
        <div className="chat-conversation-header">
          <div>
            <h3>Global Team Chat</h3>
            <p>Everyone in your workspace can see these messages.</p>
          </div>
          <button
            type="button"
            className="chat-mobile-members-toggle"
            onClick={() => setShowMembers((open) => !open)}
          >
            {showMembers ? "Hide members" : "Show members"}
          </button>
        </div>

        <div className="chat-message-stream" ref={messageListRef}>
          {chatRows.length === 0 && <p className="chat-empty-note">No messages yet. Start the conversation.</p>}

          {chatRows.map(({ message, groupLabel, showDateGroup }) => {
            const isMine = message.user_email === currentEmail;
            return (
              <div key={message.id}>
                {showDateGroup && (
                  <div className="chat-date-divider">
                    <span>{groupLabel}</span>
                  </div>
                )}
                <article className={`chat-message-item ${isMine ? "mine" : "theirs"}`}>
                  <div className="chat-message-meta">
                    <span className="chat-sender-name">{message.user_email}</span>
                    <span className={`chat-role-pill ${badgeColorClass(message.user_role)}`}>
                      {roleLabel(message.user_role)}
                    </span>
                    <span className="chat-message-time">
                      {message.created_at
                        ? new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : ""}
                    </span>
                    <div className="chat-message-actions" role="toolbar" aria-label="Message actions">
                      <button type="button" onClick={() => handleReply(message.user_email)}>Reply</button>
                      <button type="button" onClick={() => handleCopy(message.message)}>Copy</button>
                      <button type="button" disabled title="Delete is not available in this workspace">Delete</button>
                    </div>
                  </div>
                  <div className="chat-bubble">{message.message}</div>
                </article>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        {unreadCount > 0 && (
          <button type="button" className="chat-unread-banner" onClick={scrollToLatest}>
            {unreadCount} unread {unreadCount > 1 ? "messages" : "message"} - jump to latest
          </button>
        )}

        <div className="chat-composer">
          <button type="button" className="chat-icon-btn" aria-label="Attach file" title="Attach file">
            +
          </button>
          <button type="button" className="chat-icon-btn" aria-label="Add emoji" title="Emoji picker">
            :)
          </button>
          <input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(event) => handleInputChange(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && canSend && handleSend()}
            aria-label="Message input"
          />
          <button type="button" className="chat-send-btn" onClick={handleSend} disabled={!canSend}>
            {loading ? "Sending..." : "Send"}
          </button>
        </div>

        {isTyping && <div className="chat-typing-indicator">You are typing...</div>}
      </section>
    </div>
  );
}
