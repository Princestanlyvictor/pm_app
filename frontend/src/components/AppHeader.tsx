interface HeaderUser {
  email: string;
  role: string;
}

interface AppHeaderProps {
  user: HeaderUser;
  pageTitle: string;
  showDashboardButton: boolean;
  onGoDashboard: () => void;
}

export default function AppHeader({ user, pageTitle, showDashboardButton, onGoDashboard }: AppHeaderProps) {
  const profileInitial = (user.email || "U").trim().charAt(0).toUpperCase();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #E5EAF5",
        boxShadow: "0 2px 10px rgba(14,10,60,0.05)",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "12px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 20, color: "#0E0A3C" }}>PM Workspace</h1>
          <p style={{ margin: "2px 0 0", color: "#5E667A", fontSize: 13 }}>{pageTitle}</p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div
            title={`${user.email} (${user.role.replace("_", " ")})`}
            aria-label="User profile"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              backgroundColor: "#0E0A3C",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {profileInitial}
          </div>
          {showDashboardButton && (
            <button
              type="button"
              onClick={onGoDashboard}
              style={{
                padding: "8px 12px",
                backgroundColor: "#EAF0FF",
                color: "#0E0A3C",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Dashboard
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
