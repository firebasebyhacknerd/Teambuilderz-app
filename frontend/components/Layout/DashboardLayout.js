import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * DashboardLayout renders a sticky sidebar with quick navigation and
 * a header row that can show a back button plus contextual actions.
 *
 * Props:
 * - title: string – page heading
 * - subtitle: string (optional)
 * - links: array of { href, label, icon } for the sidebar navigation
 * - actions: React nodes rendered on the right side of the header
 * - onBack: callback (optional) to render a back button
 * - children: page content
 */
const DashboardLayout = ({
  title,
  subtitle,
  links = [],
  actions = null,
  onBack = null,
  children
}) => {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderLinks = () =>
    links.map(({ href, label, icon: Icon }) => {
      const isActive = router.pathname === href;
      return (
        <Link
          key={href}
          href={href}
          onClick={() => setSidebarOpen(false)}
          className={`flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            isActive
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
        >
          {Icon && <Icon size={18} />}
          <span>{label}</span>
        </Link>
      );
    });

  return (
    <div className="min-h-screen bg-muted/20 flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 bg-background border-r border-border shadow-lg transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-full flex flex-col overflow-y-auto">
          <div className="px-6 py-5 border-b border-border flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">TeamBuilderz</p>
              <h2 className="text-lg font-semibold text-foreground">Control Center</h2>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </Button>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2">{renderLinks()}</nav>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-72">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
          <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
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
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </div>
        </header>

        <main className="px-4 sm:px-6 py-6">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
