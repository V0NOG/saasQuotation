// src/components/auth/RequireAuth.tsx
import { Navigate, useLocation } from "react-router-dom";
import { isLoggedIn } from "../../api/http";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  if (!isLoggedIn()) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}