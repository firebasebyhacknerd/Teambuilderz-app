import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft, Menu, ChevronLeft, ChevronRight, X, HelpCircle, Command, Moon, Sun, Monitor } from "lucide-react";
import { Button } from "../ui/button";
import ActivityPulse from "../analytics/ActivityPulse";
import { ThemeSelect } from "../ui/theme-toggle";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "../../lib/theme";
import MobileNav from "../ui/mobile-nav";
import SearchInput from "../ui/search-input";

const STORAGE_KEY = "tbz-sidebar";
const HELP_LINK = "https://intranet.teambuilderz/policies";

const DashboardLayout = ({
  title,
  subtitle,
  links = [],
  actions = null,
  onBack = null,
  quickActions: quickActionsProp = [],
  children,
}) => {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "collapsed") {
        setSidebarCollapsed(true);
      }
    } catch (error) {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, sidebarCollapsed ? "collapsed" : "expanded");
    } catch (error) {}
  }, [sidebarCollapsed]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const sidebarWidth = sidebarCollapsed ? "w-20" : "w-72";
  const mainOffset = sidebarCollapsed ? "lg:ml-20" : "lg:ml-72";

  const defaultQuickActions = useMemo(() => {
    if (router.pathname.startsWith("/admin")) {
      return [
        {
          label: "Attendance",
          description: "Review and approve submissions",
          action: () => router.push("/admin/attendance"),
        },
        {
          label: "Reports",
          description: "View performance & compliance",
          action: () => router.push("/admin/reports"),
        },
        {
          label: "Users",
          description: "Manage admin & recruiter accounts",
          action: () => router.push("/admin/users"),
        },
      ];
    }
    return [
      {
        label: "Dashboard",
        description: "Back to recruiter home",
        action: () => router.push("/recruiter"),
      },
      {
        label: "Candidates",
        description: "Open your pipeline",
        action: () => router.push("/recruiter/candidates"),
      },
      {
        label: "Submit leave",
        description: "Scroll to the leave card",
        action: () => document.querySelector("#leave-card")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      },
    ];
  }, [router]);

  const mergedQuickActions = useMemo(() => {
    if (quickActionsProp.length > 0) {
      return quickActionsProp;
    }
    return defaultQuickActions;
  }, [defaultQuickActions, quickActionsProp]);

  const filteredQuickActions = useMemo(() => {
    if (!searchValue.trim()) {
      return mergedQuickActions;
    }
    const query = searchValue.trim().toLowerCase();
    return mergedQuickActions.filter(
      ({ label, description }) =>
        label.toLowerCase().includes(query) || description?.toLowerCase().includes(query),
    );
  }, [mergedQuickActions, searchValue]);

  const handleQuickActionSelect = (action) => {
    if (typeof action === "function") {
      action();
    }
    setCommandPaletteOpen(false);
    setSearchValue("");
  };

  const renderedLinks = useMemo(
    () =>
      links.map(({ href, label, icon: Icon }) => {
        const isActive = router.pathname === href || router.pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            onClick={() => setSidebarOpen(false)}
            title={sidebarCollapsed ? label : undefined}
            className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
              isActive
                ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            }`}
          >
            <span
              className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full transition-all duration-200 ${
                isActive ? "bg-primary" : "bg-transparent group-hover:bg-primary/40"
              }`}
            />
            <span
              className={`flex h-8 w-8 flex-none items-center justify-center rounded-md border transition-all duration-150 ${
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card group-hover:border-primary/40 group-hover:text-primary"
              }`}
            >
              {Icon && <Icon size={18} />}
            </span>
            <span
              className={`origin-left truncate text-sm transition-[opacity,transform] duration-150 ${
                sidebarCollapsed ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"
              }`}
            >
              {label}
            </span>
          </Link>
        );
      }),
    [links, router.pathname, sidebarCollapsed],
  );

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <aside
        className={`fixed inset-y-0 left-0 z-30 ${sidebarWidth} bg-card border-r border-border shadow-lg transform transition-all duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-full flex flex-col overflow-y-auto">
          <div className={`px-4 py-5 border-b border-border flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between"} gap-3`}>
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 rounded-xl bg-secondary/60 flex items-center justify-center ring-2 ring-primary/20">
                <Image src="/logo.svg" alt="TeamBuilderz logo" width={42} height={42} priority />
              </div>
              {!sidebarCollapsed && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">TeamBuilderz</p>
                  <h2 className="text-lg font-semibold text-foreground">Growth Console</h2>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:flex"
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
              >
                {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </Button>
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
                <X size={20} />
              </Button>
            </div>
          </div>
          <nav className={`flex-1 px-3 py-6 space-y-2 ${sidebarCollapsed ? "items-center" : ""} flex flex-col`}>{renderedLinks}</nav>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`flex-1 ${mainOffset} bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--surface))] to-[hsl(var(--background))] transition-[margin] duration-200`}
      >
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
          <div className="px-4 sm:px-6 py-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu size={20} />
                </Button>
                {onBack && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={onBack}>
                    <ArrowLeft size={16} />
                    Back
                  </Button>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h1>
                  {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
                </div>
              </div>
              <div className="hidden lg:flex items-center gap-3">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setCommandPaletteOpen(true)}>
                  <Command size={16} />
                  Quick actions
                  <span className="text-[11px] text-muted-foreground">⌘K</span>
                </Button>
                <Button variant="ghost" size="icon" asChild>
                  <a href={HELP_LINK} target="_blank" rel="noreferrer" aria-label="Open help center">
                    <HelpCircle size={18} />
                  </a>
                </Button>
                <ThemeSelect hideLabel />
                <ActivityPulse />
                {actions}
              </div>
            </div>
            {(actions || true) && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/60 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                  Live environment
                </div>
                <div className="flex flex-1 items-center gap-2 lg:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 flex-1"
                    onClick={() => setCommandPaletteOpen(true)}
                  >
                    <Command size={16} />
                    Quick actions
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <a href={HELP_LINK} target="_blank" rel="noreferrer" aria-label="Open help center">
                      <HelpCircle size={18} />
                    </a>
                  </Button>
                  <ThemeSelect hideLabel compact />
                  <ActivityPulse />
                  {actions}
                </div>
              </div>
            )}
            {mergedQuickActions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {mergedQuickActions.slice(0, 4).map(({ label, description, action }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleQuickActionSelect(action)}
                    className="group rounded-lg border border-border bg-card/70 px-3 py-2 text-left text-xs shadow-sm transition hover:border-primary/50 hover:bg-primary/5"
                  >
                    <p className="font-semibold text-foreground">{label}</p>
                    <p className="text-muted-foreground">{description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <main id="main-content" className="px-4 sm:px-6 py-6" tabIndex={-1}>
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
      </div>
      {commandPaletteOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm flex items-start justify-center px-4 py-12"
          onClick={() => {
            setCommandPaletteOpen(false);
            setSearchValue("");
          }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-border bg-background p-6 shadow-2xl space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Quick actions</p>
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCommandPaletteOpen(false)}>
                <X size={18} />
              </Button>
            </div>
            <input
              type="text"
              placeholder="Search actions…"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              autoFocus
            />
            <div className="max-h-72 overflow-y-auto space-y-2">
              {filteredQuickActions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No actions match “{searchValue}”.</p>
              ) : (
                filteredQuickActions.map(({ label, description, action }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleQuickActionSelect(action)}
                    className="w-full rounded-lg border border-border bg-card px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </button>
                ))
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tip: Press <span className="rounded border border-border bg-muted px-1 py-0.5">⌘/Ctrl + K</span> to open this
              palette from anywhere.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;
export { DashboardLayout };

