import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  BarChart3,
  Calendar,
  Globe,
  Newspaper,
  Brain,
  BookOpen,
  Users,
  Settings,
  Bell,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const mainNav = [
  { label: "Dashboard", icon: Home, path: "/dashboard" },
  { label: "Reports", icon: BarChart3, path: "/alerts" },
  { label: "News", icon: Newspaper, path: "/news" },
  { label: "Calendar", icon: Calendar, path: "/watchlist" },
  { label: "Macro Desk", icon: Globe, path: "/scanner" },
  { label: "Psychology", icon: Brain, path: null, soon: true },
  { label: "Journal", icon: BookOpen, path: null, soon: true },
  { label: "Community", icon: Users, path: null, soon: true },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "TS";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-background flex flex-col z-40 border-r"
      style={{ borderRightWidth: "0.5px", borderRightColor: "hsl(var(--border))" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14">
        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
          <span className="text-primary font-display font-bold text-sm">H</span>
        </div>
        <span className="text-sm font-semibold text-foreground tracking-tight">
          TrendScan
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 mt-2 flex flex-col gap-0.5 px-0">
        {mainNav.map((item) => {
          const isActive = item.path
            ? location.pathname === item.path ||
              (item.path !== "/dashboard" && location.pathname.startsWith(item.path))
            : false;

          return (
            <button
              key={item.label}
              onClick={() => item.path && navigate(item.path)}
              disabled={!item.path}
              className="relative w-full flex items-center gap-3 h-[44px] px-4 text-[13px] transition-colors group"
              style={{
                color: isActive
                  ? "hsl(var(--bullish))"
                  : "hsl(var(--muted-foreground))",
                background: isActive
                  ? "linear-gradient(90deg, rgba(0,255,127,0.06) 0%, transparent 100%)"
                  : "transparent",
                borderLeft: isActive
                  ? "3px solid hsl(var(--bullish))"
                  : "3px solid transparent",
                cursor: item.path ? "pointer" : "default",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              <span className="hidden md:inline">{item.label}</span>
              {item.soon && (
                <span
                  className="hidden md:inline-flex ml-auto text-[9px] rounded px-[5px] py-[1px]"
                  style={{
                    background: "#1a2635",
                    color: "hsl(200 30% 33%)",
                  }}
                >
                  Soon
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 pt-2 flex flex-col gap-1 border-t" style={{ borderTopWidth: "0.5px", borderTopColor: "hsl(var(--border))" }}>
        <button
          onClick={() => navigate("/settings")}
          className="w-full flex items-center gap-3 h-[44px] px-3 text-[13px] rounded-md transition-colors"
          style={{ color: "hsl(var(--muted-foreground))" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <Settings className="w-[18px] h-[18px]" />
          <span className="hidden md:inline">Settings</span>
        </button>

        <div className="flex items-center justify-between px-3 py-2">
          {/* User avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-display font-semibold shrink-0"
            style={{
              background: "hsl(var(--border))",
              color: "hsl(var(--bullish))",
            }}
          >
            {initials}
          </div>

          {/* Bell */}
          <button
            className="relative p-1.5 rounded-md transition-colors"
            style={{ color: "hsl(var(--muted-foreground))" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            onClick={() => navigate("/alerts")}
          >
            <Bell className="w-[18px] h-[18px]" />
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full"
              style={{ background: "hsl(var(--bullish))" }}
            />
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: "hsl(var(--muted-foreground))" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            title="Sign out"
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </aside>
  );
}
