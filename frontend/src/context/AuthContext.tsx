import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import api from "../services/api";
import { AuthContext } from "./AuthContextType";

export { AuthContext } from "./AuthContextType";

interface User {
  id: string;
  role: string;
  email: string;
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);

    const res = await api.post("/auth/token", form);
    const newToken = res.data.access_token;
    setToken(newToken);
    
    // Decode token to get user info
    const payload = JSON.parse(atob(newToken.split('.')[1]));
    setUser({
      id: payload.sub,
      role: payload.role,
      email: email
    });
    
    return true;
  };

  const register = async (email: string, password: string, role: string = "user", name?: string) => {
    await api.post("/auth/register", {
      name,
      email,
      password,
      role,
    });
    return true;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated: !!token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
