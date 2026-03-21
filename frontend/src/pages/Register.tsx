import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import "./Login.css";

export default function Register({ switchToLogin }: { switchToLogin: () => void }) {
  const { register } = useContext(AuthContext);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("team_member");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setError("");
      setLoading(true);
      const fullName = `${firstName} ${lastName}`.trim();
      await register(email, password, role, fullName || undefined);
      alert("Registration successful. Please login.");
      switchToLogin();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-minimal">
      <div className="auth-box">
        <div className="auth-logo">P</div>
        <p className="eyebrow">Workspace Onboarding</p>
        <h1>Create account</h1>
        <p className="sub">Fill your details to get started in your workspace.</p>
        <div className="auth-role-tags">
          <span>Admin</span>
          <span>User</span>
        </div>

        <div className="auth-grid-two">
          <div>
            <label className="field-label" htmlFor="first-name">First name</label>
            <input
              id="first-name"
              className="text-input"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="last-name">Last name</label>
            <input
              id="last-name"
              className="text-input"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>
        </div>

        <label className="field-label" htmlFor="email">Email</label>
        <input
          id="email"
          className="text-input"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <label className="field-label" htmlFor="password">Password</label>
        <input
          id="password"
          className="text-input"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />

        <label className="field-label">Role</label>
        <div className="role-switch">
          <button
            type="button"
            className={`role-btn ${role === "project_manager" ? "active" : ""}`}
            onClick={() => setRole("project_manager")}
          >
            Project Manager
          </button>
          <button
            type="button"
            className={`role-btn ${role === "team_member" ? "active" : ""}`}
            onClick={() => setRole("team_member")}
          >
            Team Member
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <button className="primary-btn" type="button" onClick={submit} disabled={loading}>
          {loading ? "Creating account..." : "Continue"}
        </button>

        <p className="helper-text">
          Already have an account? <button className="ghost-link" type="button" onClick={switchToLogin}>Login</button>
        </p>
      </div>
    </div>
  );
}
