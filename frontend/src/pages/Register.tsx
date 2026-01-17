import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import "./Login.css";

export default function Register({ switchToLogin }: { switchToLogin: () => void }) {
  const { register } = useContext(AuthContext);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setError("");
      setLoading(true);
      // Only team_member registration here; project manager is not selectable
      await register(email, password, "team_member", name);
      alert("Registration successful. Please login.");
      switchToLogin();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-minimal">
      <div className="auth-box">
        <h1>Create account</h1>
        <p className="sub">Sign up as a team member to get started.</p>

        <label className="field-label" htmlFor="name">Name</label>
        <input
          id="name"
          className="text-input"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />

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
          autoComplete="new-password"
        />

        {error && <div className="error-banner">{error}</div>}

        <button className="primary-btn" type="button" onClick={submit} disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </button>

        <p className="helper-text">
          Already have an account? <button className="ghost-link" type="button" onClick={switchToLogin}>Login</button>
        </p>
      </div>
    </div>
  );
}
