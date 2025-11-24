import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Home, Users, FileText, Settings, Bell, ChevronDown } from 'lucide-react';
import { Button } from './button';
import { Card } from './card';
import { ThemeToggle } from '../../lib/theme';

const MobileNav = ({ userRole = 'Admin', links = [] }) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setActiveDropdown(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const toggleDropdown = (menu) => {
    setActiveDropdown(activeDropdown === menu ? null : menu);
  };

  const handleNavigation = (path) => {
    router.push(path);
    setIsOpen(false);
    setActiveDropdown(null);
  };

  const defaultLinks = {
    Admin: [
      { label: 'Dashboard', icon: Home, href: '/admin' },
      { 
        label: 'Management', 
        icon: Settings, 
        href: '#',
        submenu: [
          { label: 'Users', href: '/admin/users' },
          { label: 'Attendance', href: '/admin/attendance' },
          { label: 'Reports', href: '/admin/reports' }
        ]
      },
      { label: 'Alerts', icon: Bell, href: '/alerts' },
    ],
    Recruiter: [
      { label: 'Dashboard', icon: Home, href: '/recruiter' },
      { 
        label: 'Candidates', 
        icon: Users, 
        href: '#',
        submenu: [
          { label: 'My Candidates', href: '/recruiter/candidates' },
          { label: 'Applications', href: '/recruiter/applications' },
          { label: 'Interviews', href: '/recruiter/interviews' }
        ]
      },
      { label: 'Reports', icon: FileText, href: '/recruiter/reports' },
    ]
  };

  const navigationLinks = links.length > 0 ? links : defaultLinks[userRole] || [];

  return (
    <div className="lg:hidden">
      {/* Mobile Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-md hover:bg-accent transition-colors"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </motion.button>
          <h1 className="text-lg font-semibold">TeamBuilderz</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="px-2" />
        </div>
      </div>

      {/* Mobile Navigation Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Slide-out Menu */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-80 bg-card border-r z-50 overflow-y-auto"
            >
              <div className="p-4">
                {/* Menu Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Menu</h2>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-md hover:bg-accent transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </motion.button>
                </div>

                {/* Navigation Items */}
                <nav className="space-y-2">
                  {navigationLinks.map((item, index) => {
                    const Icon = item.icon;
                    const hasSubmenu = item.submenu && item.submenu.length > 0;
                    const isActive = activeDropdown === index;

                    return (
                      <div key={item.label}>
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          {hasSubmenu ? (
                            <button
                              onClick={() => toggleDropdown(index)}
                              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <Icon className="h-5 w-5" />
                                <span className="font-medium">{item.label}</span>
                              </div>
                              <ChevronDown 
                                className={`h-4 w-4 transition-transform duration-200 ${isActive ? 'rotate-180' : ''}`} 
                              />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleNavigation(item.href)}
                              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                router.pathname === item.href 
                                  ? 'bg-primary text-primary-foreground' 
                                  : 'hover:bg-accent'
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                              <span className="font-medium">{item.label}</span>
                            </button>
                          )}
                        </motion.div>

                        {/* Submenu */}
                        <AnimatePresence>
                          {hasSubmenu && isActive && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="ml-8 mt-1 space-y-1 overflow-hidden"
                            >
                              {item.submenu.map((subItem, subIndex) => (
                                <motion.button
                                  key={subItem.label}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: subIndex * 0.05 }}
                                  onClick={() => handleNavigation(subItem.href)}
                                  className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                                    router.pathname === subItem.href
                                      ? 'bg-accent text-accent-foreground font-medium'
                                      : 'hover:bg-accent/50'
                                  }`}
                                >
                                  {subItem.label}
                                </motion.button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </nav>

                {/* User Section */}
                <div className="mt-8 pt-6 border-t">
                  <div className="space-y-3">
                    <ThemeToggle />
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => {
                        localStorage.clear();
                        router.push('/login');
                      }}
                    >
                      Sign Out
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileNav;



