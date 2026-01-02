import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function Login({ switchToRegister }: any) {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    try {
      setError("");
      await login(email, password);
      // Navigation happens automatically via App.tsx when isAuthenticated changes
    } catch (err: any) {
      setError(err.response?.data?.detail || "Login failed");
    }
  };

  return (
    <div>
      <h2>Login</h2>

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

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button onClick={submit}>Login</button>

      <p>
        New user?{" "}
        <button onClick={switchToRegister}>Register</button>
      </p>
    </div>
  );
}
