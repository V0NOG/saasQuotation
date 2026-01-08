// frontend/src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { setAccessToken } from "../api/http";
import { authApi } from "../api/authApi"; // ✅ NEW

export type SocialLinks = {
  facebook?: string;
  x?: string;
  linkedin?: string;
  instagram?: string;
};

export type AuthUser = {
  id: string; // IMPORTANT: your backend returns user.id, not _id
  firstName?: string;
  lastName?: string;
  email: string;
  role?: string;

  // profile fields
  bio?: string;
  phone?: string;
  socials?: SocialLinks;
  address?: {
    country?: string;
    cityState?: string;
    postalCode?: string;
    taxId?: string;
  };
};

export type AuthOrg = {
  id: string;
  name: string;
  currency: string;
  taxRate: number;
  branding: {
    logoUrl: string;
    primaryColor: string;
    accentColor: string;
  };
  industry?: "plumber" | "electrician" | "both";
};

type AuthContextValue = {
  user: AuthUser | null;
  org: AuthOrg | null;
  isAuthenticated: boolean;

  setUser: (u: AuthUser | null) => void;
  setOrg: (o: AuthOrg | null) => void;

  // ✅ make logout async so we can clear refresh cookie on server
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USER_KEY = "authUser";
const ORG_KEY = "authOrg";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() => safeParse<AuthUser>(localStorage.getItem(USER_KEY)));
  const [org, setOrgState] = useState<AuthOrg | null>(() => safeParse<AuthOrg>(localStorage.getItem(ORG_KEY)));

  const setUser = (u: AuthUser | null) => {
    setUserState(u);
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  };

  const setOrg = (o: AuthOrg | null) => {
    setOrgState(o);
    if (o) localStorage.setItem(ORG_KEY, JSON.stringify(o));
    else localStorage.removeItem(ORG_KEY);
  };

  const logout = async () => {
    // 1) clear refresh cookie on server (best-effort)
    try {
      await authApi.logout();
    } catch {
      // ignore
    }

    // 2) clear access token + local cached auth
    setAccessToken(null);
    setUser(null);
    setOrg(null);
  };

  // keep in sync if http.ts dispatches auth:changed
  useEffect(() => {
    const onAuthChanged = () => {
      const token = localStorage.getItem("userToken");
      if (!token) {
        setUser(null);
        setOrg(null);
      }
    };
    window.addEventListener("auth:changed", onAuthChanged);
    return () => window.removeEventListener("auth:changed", onAuthChanged);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      org,
      isAuthenticated: !!user,
      setUser,
      setOrg,
      logout,
    }),
    [user, org]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}