import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import "./Login.css";

export default function Login({ switchToRegister }: { switchToRegister: () => void }) {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState<"pending" | "rejected" | "invalid" | "">("");
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"admin" | "user">("user");

  const submit = async () => {
    try {
      setError("");
      setErrorType("");
      setLoading(true);
      await login(email, password);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { detail?: string } } };
      const detail = error.response?.data?.detail || "Login failed";
      
      // Handle pending approval status (403 Forbidden)
      if (error.response?.status === 403) {
        if (detail.includes("pending")) {
          setErrorType("pending");
          setError("⏳ " + detail);
        } else if (detail.includes("rejected")) {
          setErrorType("rejected");
          setError("❌ " + detail);
        } else {
          setErrorType("invalid");
          setError("❌ " + detail);
        }
      }
      // Handle invalid credentials (401 Unauthorized)
      else if (error.response?.status === 401) {
        setErrorType("invalid");
        setError("❌ " + detail);
      }
      // Handle other errors
      else {
        setErrorType("invalid");
        setError("❌ " + detail);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
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
          <button
            type="button"
            className={`role-tag ${selectedRole === "admin" ? "active" : ""}`}
            onClick={() => setSelectedRole("admin")}
          >
            Admin
          </button>
          <button
            type="button"
            className={`role-tag ${selectedRole === "user" ? "active" : ""}`}
            onClick={() => setSelectedRole("user")}
          >
            User
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

        <label className="field-label" htmlFor="password">Password</label>
        <div className="password-field-wrapper">
          <input
            id="password"
            className="text-input"
            type={showPassword ? "text" : "password"}
            placeholder="--------"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={handlePasswordKeyPress}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="eye-toggle-btn"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.88 9.88L4.62 4.62M1 1l22 22" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {error && (
          <div className={`error-banner ${
            errorType === "pending" ? "pending-approval" : 
            errorType === "rejected" ? "rejected-account" :
            "invalid-credentials"
          }`}>
            {error}
          </div>
        )}

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
