import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function Dashboard() {
  const { user, logout } = useContext(AuthContext);

  return (
    <div style={{ padding: 40 }}>
      <h1>Dashboard</h1>
      <div style={{ marginBottom: 20 }}>
        <h2>My Account</h2>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Role:</strong> {user?.role}</p>
      </div>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
