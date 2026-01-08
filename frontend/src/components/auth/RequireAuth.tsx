// RequireAuth.tsx
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { isLoggedIn } from "../../api/http";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [loggedIn, setLoggedIn] = useState(() => isLoggedIn());

  useEffect(() => {
    const onAuthChanged = () => setLoggedIn(isLoggedIn());
    window.addEventListener("auth:changed", onAuthChanged);
    return () => window.removeEventListener("auth:changed", onAuthChanged);
  }, []);

  if (!loggedIn) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}