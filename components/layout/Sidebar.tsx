"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings,
  TrendingUp,
  Menu,
  X,
  ChevronDown,
  Handshake,
  Briefcase,
  BarChart3,
  Landmark,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem { href: string; label: string }
interface NavSection {
  key: string;
  label: string;
  icon: LucideIcon;
  // Section dashboard; sections without one only expand/collapse.
  href?: string;
  items: NavItem[];
  // Extra routes (detail pages, workspaces) that belong to this section.
  related?: string[];
}

const SECTIONS: NavSection[] = [
  {
    key: "sourcing",
    label: "Sourcing / CRM",
    icon: Handshake,
    href: "/",
    items: [
      { href: "/pipeline",  label: "Pipeline" },
      { href: "/sourcing",  label: "Hunt" },
      { href: "/companies", label: "Companies" },
      { href: "/contacts",  label: "Contacts" },
    ],
  },
  {
    key: "deals",
    label: "Deal Execution",
    icon: Briefcase,
    href: "/deals",
    items: [{ href: "/underwrite", label: "Underwrite" }],
    related: ["/live-deal"],
  },
  {
    key: "portfolio",
    label: "Portfolio Monitoring",
    icon: BarChart3,
    href: "/portfolio",
    items: [],
  },
  {
    key: "lp",
    label: "LP Fundraising & Comms",
    icon: Landmark,
    href: "/lp",
    items: [
      { href: "/fund-model",   label: "GP Fund Model" },
      { href: "/lp-reporting", label: "LP Update Memos" },
    ],
  },
  {
    key: "other",
    label: "Other",
    icon: Layers,
    items: [
      { href: "/comps",   label: "Transaction Comps Tracker" },
      { href: "/dealfit", label: "Deal Share" },
    ],
  },
];

const STORAGE_KEY = "geos.sidebar.open";

const matches = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

const sectionFor = (pathname: string) =>
  SECTIONS.find((s) =>
    (s.href && matches(pathname, s.href)) ||
    s.items.some((i) => matches(pathname, i.href)) ||
    s.related?.some((r) => matches(pathname, r))
  )?.key;

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ sourcing: true });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setExpanded((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch { /* storage unavailable */ }
  }, []);

  // Always show the section you're currently in.
  useEffect(() => {
    const current = sectionFor(pathname);
    if (current) setExpanded((prev) => (prev[current] ? prev : { ...prev, [current]: true }));
  }, [pathname]);

  const toggle = (key: string, open?: boolean) =>
    setExpanded((prev) => {
      const next = { ...prev, [key]: open ?? !prev[key] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });

  const close = () => setMobileOpen(false);
  const currentSection = sectionFor(pathname);

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-slate-900 border-b border-slate-700/50 flex items-center gap-3 px-4 lg:hidden z-50">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-slate-400 hover:text-white p-1 -ml-1"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500">
            <TrendingUp size={15} className="text-white" />
          </div>
          <span className="text-sm font-bold text-white">GEOS</span>
        </Link>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={close} />
      )}

      <aside
        className={cn(
          "flex h-screen w-64 flex-col bg-slate-900 text-slate-100 shrink-0 transition-transform duration-200 ease-in-out",
          "fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 lg:z-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-700/50">
          <Link href="/" onClick={close} className="flex items-center gap-2.5 flex-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
              <TrendingUp className="text-white" size={18} />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide text-white">GEOS</div>
              <div className="text-[10px] text-slate-400 tracking-wider uppercase">Growth Equity OS</div>
            </div>
          </Link>
          <button onClick={close} className="text-slate-500 hover:text-slate-300 lg:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Sections */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          {SECTIONS.map((section, idx) => {
            const Icon = section.icon;
            const isOpen = !!expanded[section.key];
            const onDashboard = !!section.href && matches(pathname, section.href);
            const inSection = currentSection === section.key;
            const hasItems = section.items.length > 0;

            const headerClass = cn(
              "flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors min-w-0",
              onDashboard
                ? "bg-blue-600 text-white"
                : inSection
                ? "text-white hover:bg-slate-800"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            );

            return (
              <div key={section.key} className={cn(idx > 0 && "mt-2 pt-2 border-t border-slate-700/50")}>
                <div className="flex items-center gap-1">
                  {section.href ? (
                    <Link
                      href={section.href}
                      onClick={() => { if (hasItems) toggle(section.key, true); close(); }}
                      className={headerClass}
                    >
                      <Icon size={17} className="shrink-0" />
                      <span className="leading-snug">{section.label}</span>
                    </Link>
                  ) : (
                    <button onClick={() => toggle(section.key)} className={cn(headerClass, "text-left")}>
                      <Icon size={17} className="shrink-0" />
                      <span className="leading-snug">{section.label}</span>
                    </button>
                  )}
                  {hasItems && (
                    <button
                      onClick={() => toggle(section.key)}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      aria-label={isOpen ? `Collapse ${section.label}` : `Expand ${section.label}`}
                      aria-expanded={isOpen}
                    >
                      <ChevronDown size={15} className={cn("transition-transform", isOpen && "rotate-180")} />
                    </button>
                  )}
                </div>

                {hasItems && isOpen && (
                  <div className="mt-0.5 mb-1 space-y-0.5">
                    {section.items.map((item) => {
                      const active = matches(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={close}
                          className={cn(
                            "block rounded-lg py-2 pl-11 pr-3 text-sm transition-colors",
                            active ? "bg-blue-600 text-white font-medium" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                          )}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Settings + footer */}
        <div className="px-3 py-3 border-t border-slate-700/50">
          <Link
            href="/settings"
            onClick={close}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              matches(pathname, "/settings") ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            )}
          >
            <Settings size={16} />
            Settings
          </Link>
          <p className="px-3 mt-2 text-[11px] text-slate-500">Growth Equity Operating System</p>
        </div>
      </aside>
    </>
  );
}
