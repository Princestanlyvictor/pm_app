import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function Register({ switchToLogin }: any) {
  const { register } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("team_member");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setError("");
      setLoading(true);
      await register(email, password, role);
      alert("Registration successful. Please login.");
      switchToLogin();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Register</h2>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <br /><br />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <br /><br />

      <label htmlFor="role">Select Role:</label>
      <br />
      <select value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: 8, marginTop: 10 }}>
        <option value="team_member">Team Member</option>
        <option value="project_manager">Project Manager</option>
      </select>
      <br /><br />

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button onClick={submit} disabled={loading}>
        {loading ? "Registering..." : "Register"}
      </button>

      <p>
        Already have an account?{" "}
        <button onClick={switchToLogin}>Login</button>
      </p>
    </div>
  );
}
