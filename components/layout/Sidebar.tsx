"use client";

import { useState } from "react";
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
  Calculator,
  Zap,
  FileSpreadsheet,
  Scale,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sourcingSubItems = [
  { href: "/sourcing",  label: "Hunt",           icon: Sparkles },
  { href: "/crm",       label: "Activity",        icon: ActivitySquare },
  { href: "/outreach",  label: "Outreach",         icon: Send },
  { href: "/pipeline",  label: "Pipeline",         icon: GitMerge },
];

const mainItems = [
  { href: "/companies",    label: "Companies",              icon: Building2       },
  { href: "/live-deal",    label: "Live Deal",              icon: Briefcase       },
  { href: "/underwrite",   label: "Underwrite",             icon: FileSpreadsheet },
  { href: "/comps",        label: "Transaction Comps",      icon: Scale           },
  { href: "/portfolio",    label: "Portfolio / Investments",icon: BarChart3       },
  { href: "/lp-reporting", label: "LP Comms / Reporting",   icon: Users           },
  { href: "/fund-model",   label: "GP Fund Model",          icon: Calculator      },
  { href: "/dealfit",      label: "DealFit",                icon: Zap             },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const close = () => setOpen(false);

  const navLink = (href: string, label: string, Icon: LucideIcon, sub = false) => {
    const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={close}
        className={cn(
          "flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors",
          sub ? "px-3 pl-8" : "px-3",
          isActive
            ? "bg-blue-600 text-white"
            : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        )}
      >
        <Icon size={16} />
        {label}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-slate-900 border-b border-slate-700/50 flex items-center gap-3 px-4 lg:hidden z-50">
        <button
          onClick={() => setOpen(true)}
          className="text-slate-400 hover:text-white p-1 -ml-1"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500">
            <TrendingUp size={15} className="text-white" />
          </div>
          <span className="text-sm font-bold text-white">GEOS</span>
        </div>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={close}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "flex h-screen w-64 flex-col bg-slate-900 text-slate-100 shrink-0 transition-transform duration-200 ease-in-out",
          "fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 lg:z-auto",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-700/50">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
            <TrendingUp className="text-white" size={18} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold tracking-wide text-white">GEOS</div>
            <div className="text-[10px] text-slate-400 tracking-wider uppercase">
              Growth Equity OS
            </div>
          </div>
          <button
            onClick={close}
            className="text-slate-500 hover:text-slate-300 lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">

          {/* Dashboard */}
          <div className="space-y-0.5">
            {navLink("/", "Dashboard", LayoutDashboard)}
          </div>

          {/* Sourcing section */}
          <div className="mt-5 mb-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Sourcing
            </p>
          </div>
          <div className="space-y-0.5">
            {sourcingSubItems.map(({ href, label, icon: Icon }) =>
              navLink(href, label, Icon, true)
            )}
          </div>

          {/* Main standalone items */}
          <div className="mt-5 space-y-0.5">
            {mainItems.map(({ href, label, icon: Icon }) =>
              navLink(href, label, Icon)
            )}
          </div>

          {/* Settings */}
          <div className="mt-5 mb-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Settings
            </p>
          </div>
          <div className="space-y-0.5">
            {navLink("/settings", "Settings", Settings)}
          </div>

        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-slate-700/50">
          <p className="text-[11px] text-slate-500">Growth Equity Operating System</p>
          <p className="text-[11px] text-slate-600">v1.0.0</p>
        </div>
      </aside>
    </>
  );
}
