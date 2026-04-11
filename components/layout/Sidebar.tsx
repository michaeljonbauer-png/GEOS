"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  GitMerge,
  Send,
  ActivitySquare,
  Settings,
  TrendingUp,
  BarChart3,
  Briefcase,
  Users,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Sparkles },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/pipeline", label: "Pipeline", icon: GitMerge },
  { href: "/outreach", label: "Outreach", icon: Send },
  { href: "/crm", label: "Activity", icon: ActivitySquare },
];

const dealItems = [
  { href: "/live-deal", label: "Live Deal", icon: Briefcase },
  { href: "/portfolio", label: "Portfolio", icon: BarChart3 },
  { href: "/lp-reporting", label: "LP Communications", icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();

  const navLink = (href: string, label: string, Icon: LucideIcon) => {
    const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-blue-600 text-white"
            : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        )}
      >
        <Icon size={17} />
        {label}
      </Link>
    );
  };

  return (
    <aside className="flex h-screen w-60 flex-col bg-slate-900 text-slate-100 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-700/50">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
          <TrendingUp className="h-4.5 w-4.5 text-white" size={18} />
        </div>
        <div>
          <div className="text-sm font-bold tracking-wide text-white">GEOS</div>
          <div className="text-[10px] text-slate-400 tracking-wider uppercase">
            Growth Equity OS
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => navLink(href, label, Icon))}

        <div className="pt-4 pb-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Deals &amp; Portfolio
          </p>
        </div>
        {dealItems.map(({ href, label, icon: Icon }) => navLink(href, label, Icon))}

        <div className="pt-4 pb-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Settings
          </p>
        </div>
        {navLink("/settings", "Settings", Settings)}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-700/50">
        <p className="text-[11px] text-slate-500">Growth Equity Operating System</p>
        <p className="text-[11px] text-slate-600">v1.0.0</p>
      </div>
    </aside>
  );
}
