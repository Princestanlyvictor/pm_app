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
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-minimal">
      <div className="auth-box">
        <div className="auth-logo">P</div>
        <p className="eyebrow">Secure Access</p>
        <h1>Welcome back</h1>
        <p className="sub">Sign in to continue to your dashboard workspace.</p>
        <div className="auth-role-tags">
          <span>Admin</span>
          <span>User</span>
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
          Need an account? <button className="ghost-link" type="button" onClick={switchToRegister}>Register</button>
        </p>
      </div>
    </div>
  );
}
