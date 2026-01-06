import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { setAccessToken } from "../api/http";
import { authApi } from "../api/authApi";

export type AuthUser = {
  _id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (u: AuthUser | null) => void;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const USER_KEY = "authUser";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function safeParseUser(raw: string | null): AuthUser | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() =>
    safeParseUser(localStorage.getItem(USER_KEY))
  );

  const setUser = (u: AuthUser | null) => {
    setUserState(u);
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  };

  const logout = () => {
    // clears token + dispatches auth:changed (your http.ts already does this)
    setAccessToken(null);
    setUser(null);
  };

  const refreshMe = async () => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      // token invalid or backend says no -> fully log out
      logout();
    }
  };

  // When token changes (login/logout), sync user
  useEffect(() => {
    const onAuthChanged = () => {
      const token = localStorage.getItem("userToken");
      if (!token) setUser(null);
    };
    window.addEventListener("auth:changed", onAuthChanged);
    return () => window.removeEventListener("auth:changed", onAuthChanged);
  }, []);

  // Optional: on first mount, fetch /me if token exists
  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (token && !user) {
      refreshMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      setUser,
      logout,
      refreshMe,
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}