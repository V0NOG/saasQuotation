// AppLayout.tsx
import { useEffect } from "react";
import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function onBillingRequired(e: Event) {
      // Avoid loops / weird redirects
      if (location.pathname === "/billing") return;
      if (location.pathname.startsWith("/signin")) return;

      navigate("/billing", {
        replace: true,
        state: { from: location.pathname, reason: "billing_required" },
      });
    }

    window.addEventListener("billing:required", onBillingRequired);
    return () => window.removeEventListener("billing:required", onBillingRequired);
  }, [navigate, location.pathname]);

  return (
    <div className="min-h-screen xl:flex">
      <AppSidebar />
      <Backdrop />
      <div
        className={`flex-1 transition-all duration-300 ease-in-out  ${
          isExpanded || isHovered ? "xl:ml-[290px]" : "xl:ml-[90px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <AppHeader />
        <div className="p-4 pb-20 mx-auto max-w-(--breakpoint-2xl) md:p-6 md:pb-24">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
};

export default AppLayout;