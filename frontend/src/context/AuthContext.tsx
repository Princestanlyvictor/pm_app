import { createContext, useState, useEffect } from "react";
import api from "../services/api";

export const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: any) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      setIsAuthenticated(true);
    } else {
      localStorage.removeItem("token");
      setIsAuthenticated(false);
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
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
