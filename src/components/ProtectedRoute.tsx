import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";
import type { Permission } from "@/lib/permissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Optional permission required to view this route. */
  permission?: Permission;
}

export function ProtectedRoute({ children, permission }: ProtectedRouteProps) {
  const location = useLocation();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn());
  const hasPermission = useAuthStore((s) => s.hasPermission);

  if (!isLoggedIn) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}
