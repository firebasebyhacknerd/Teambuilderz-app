import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Home,
  Users,
  FileText,
  BarChart3,
  Download,
  LogOut,
  Settings,
  Bell,
  Zap,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { Input } from './ui/input';

const CommandPalette = () => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Define all available commands
  const commands = [
    // Navigation
    {
      id: 'home',
      label: 'Go to Dashboard',
      description: 'View your main dashboard',
      icon: Home,
      category: 'Navigation',
      action: () => router.push('/recruiter'),
      keywords: ['dashboard', 'home', 'main'],
    },
    {
      id: 'candidates',
      label: 'Go to Candidates',
      description: 'View and manage candidates',
      icon: Users,
      category: 'Navigation',
      action: () => router.push('/recruiter/candidates'),
      keywords: ['candidates', 'people', 'talent'],
    },
    {
      id: 'applications',
      label: 'Go to Applications',
      description: 'View and manage applications',
      icon: FileText,
      category: 'Navigation',
      action: () => router.push('/recruiter/applications'),
      keywords: ['applications', 'submissions', 'jobs'],
    },
    {
      id: 'admin-dashboard',
      label: 'Go to Admin Dashboard',
      description: 'View admin dashboard',
      icon: BarChart3,
      category: 'Navigation',
      action: () => router.push('/admin'),
      keywords: ['admin', 'dashboard', 'analytics'],
    },
    {
      id: 'reports',
      label: 'Go to Reports',
      description: 'View and export reports',
      icon: Download,
      category: 'Navigation',
      action: () => router.push('/admin/reports'),
      keywords: ['reports', 'export', 'pdf'],
    },
    {
      id: 'alerts',
      label: 'Go to Alerts',
      description: 'View system alerts',
      icon: Bell,
      category: 'Navigation',
      action: () => router.push('/alerts'),
      keywords: ['alerts', 'notifications', 'messages'],
    },
    {
      id: 'performance',
      label: 'Go to Performance',
      description: 'View performance analytics',
      icon: Zap,
      category: 'Navigation',
      action: () => router.push('/admin/performance'),
      keywords: ['performance', 'analytics', 'metrics'],
    },

    // Actions
    {
      id: 'export-candidates',
      label: 'Export Candidates',
      description: 'Export candidates as PDF',
      icon: Download,
      category: 'Actions',
      action: () => {
        router.push('/recruiter/candidates');
        setTimeout(() => {
          const exportBtn = document.querySelector('[data-export-candidates]');
          exportBtn?.click();
        }, 500);
      },
      keywords: ['export', 'pdf', 'candidates', 'download'],
    },
    {
      id: 'export-applications',
      label: 'Export Applications',
      description: 'Export applications as PDF',
      icon: Download,
      category: 'Actions',
      action: () => {
        router.push('/recruiter/applications');
        setTimeout(() => {
          const exportBtn = document.querySelector('[data-export-applications]');
          exportBtn?.click();
        }, 500);
      },
      keywords: ['export', 'pdf', 'applications', 'download'],
    },

    // Settings
    {
      id: 'settings',
      label: 'Settings',
      description: 'Open application settings',
      icon: Settings,
      category: 'Settings',
      action: () => router.push('/settings'),
      keywords: ['settings', 'preferences', 'config'],
    },
    {
      id: 'logout',
      label: 'Logout',
      description: 'Sign out of your account',
      icon: LogOut,
      category: 'Settings',
      action: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        router.push('/login');
      },
      keywords: ['logout', 'sign out', 'exit'],
    },
  ];

  // Filter commands based on query
  const filteredCommands = query
    ? commands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.description.toLowerCase().includes(query.toLowerCase()) ||
          cmd.keywords.some((kw) => kw.includes(query.toLowerCase()))
      )
    : commands;

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {});

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(!isOpen);
        setQuery('');
        setSelectedIndex(0);
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
      }

      // Arrow keys to navigate
      if (isOpen) {
        const allCommands = Object.values(groupedCommands).flat();
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % allCommands.length);
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + allCommands.length) % allCommands.length);
        }

        // Enter to execute
        if (e.key === 'Enter') {
          e.preventDefault();
          const allCommands = Object.values(groupedCommands).flat();
          if (allCommands[selectedIndex]) {
            allCommands[selectedIndex].action();
            setIsOpen(false);
            setQuery('');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, query, groupedCommands, selectedIndex]);

  return (
    <>
      {/* Keyboard Shortcut Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/50 hover:bg-muted text-sm text-muted-foreground transition-colors"
        title="Press Cmd+K to open"
      >
        <Search className="h-4 w-4" />
        <span>Search...</span>
        <kbd className="ml-auto text-xs px-2 py-1 bg-background border border-border rounded">
          ⌘K
        </kbd>
      </button>

      {/* Command Palette Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />

            {/* Palette */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className="fixed top-1/4 left-1/2 transform -translate-x-1/2 w-full max-w-2xl z-50"
            >
              <div className="bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
                {/* Search Input */}
                <div className="border-b border-border p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      autoFocus
                      placeholder="Search commands..."
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setSelectedIndex(0);
                      }}
                      className="pl-10 text-lg"
                    />
                  </div>
                </div>

                {/* Commands List */}
                <div className="max-h-96 overflow-y-auto">
                  {Object.entries(groupedCommands).length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <p>No commands found for "{query}"</p>
                    </div>
                  ) : (
                    Object.entries(groupedCommands).map(([category, cmds]) => (
                      <div key={category}>
                        {/* Category Header */}
                        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/30">
                          {category}
                        </div>

                        {/* Commands */}
                        {cmds.map((cmd, idx) => {
                          const Icon = cmd.icon;
                          const isSelected =
                            selectedIndex ===
                            Object.values(groupedCommands)
                              .flat()
                              .findIndex((c) => c.id === cmd.id);

                          return (
                            <motion.button
                              key={cmd.id}
                              onClick={() => {
                                cmd.action();
                                setIsOpen(false);
                                setQuery('');
                              }}
                              onMouseEnter={() => {
                                setSelectedIndex(
                                  Object.values(groupedCommands)
                                    .flat()
                                    .findIndex((c) => c.id === cmd.id)
                                );
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-muted text-foreground'
                              }`}
                            >
                              <Icon className="h-5 w-5 flex-shrink-0" />
                              <div className="flex-1 text-left">
                                <div className="font-medium">{cmd.label}</div>
                                <div className="text-xs opacity-70">{cmd.description}</div>
                              </div>
                              <ChevronRight className="h-4 w-4 flex-shrink-0 opacity-50" />
                            </motion.button>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-border px-4 py-3 bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
                  <div className="flex gap-4">
                    <span>
                      <kbd className="px-2 py-1 bg-background border border-border rounded">
                        ↑↓
                      </kbd>
                      {' '}Navigate
                    </span>
                    <span>
                      <kbd className="px-2 py-1 bg-background border border-border rounded">
                        ↵
                      </kbd>
                      {' '}Select
                    </span>
                    <span>
                      <kbd className="px-2 py-1 bg-background border border-border rounded">
                        esc
                      </kbd>
                      {' '}Close
                    </span>
                  </div>
                  <Clock className="h-4 w-4" />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default CommandPalette;
