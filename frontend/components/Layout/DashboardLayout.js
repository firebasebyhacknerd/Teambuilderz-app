import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeft, Menu, X } from 'lucide-react';

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
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150 ${
            isActive
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
          }`}
        >
          {Icon && <Icon size={18} />}
          <span className="font-medium">{label}</span>
        </Link>
      );
    });

  return (
    <div className="min-h-screen bg-gray-50/70 flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 bg-white border-r border-gray-200 shadow-lg transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-full flex flex-col overflow-y-auto">
          <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">TeamBuilderz</p>
              <h2 className="text-lg font-semibold text-gray-900">Control Center</h2>
            </div>
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </button>
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
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200">
          <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="lg:hidden inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100"
                >
                  <ArrowLeft size={18} />
                  Back
                </button>
              )}
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>
                {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
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
