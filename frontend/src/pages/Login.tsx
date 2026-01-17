import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import "./Login.css";

export default function Login({ switchToRegister }: { switchToRegister: () => void }) {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setError("");
      setLoading(true);
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-card__left">
          <p className="eyebrow">Project Flow</p>
          <h1>Sign in to your workspace</h1>
          <p className="lede">
            Track projects, collaborate with your team, and keep requests moving. Use your work
            email to continue.
          </p>
          <div className="pill-list">
            <span className="pill">Secure login</span>
            <span className="pill">Project manager ready</span>
            <span className="pill">Chat + Kanban</span>
          </div>
        </div>

        <div className="auth-card__right">
          <div className="form-heading">
            <div>
              <p className="eyebrow small">Welcome back</p>
              <h3>Enter your credentials</h3>
            </div>
            <button className="ghost-link" type="button" onClick={switchToRegister}>
              Create account
            </button>
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

          <div className="field-row">
            <label className="field-label" htmlFor="password">Password</label>
            <button className="ghost-link" type="button">Forgot?</button>
          </div>
          <input
            id="password"
            className="text-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {error && <div className="error-banner">{error}</div>}

          <button className="primary-btn" type="button" onClick={submit} disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p className="helper-text">
            Need access? <button className="ghost-link" type="button" onClick={switchToRegister}>Register</button>
          </p>
        </div>
      </div>
    </div>
  );
}
