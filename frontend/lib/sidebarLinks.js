import {
  Home,
  Users,
  UserCheck,
  TrendingUp,
  BarChart3,
  FileText,
  AlertTriangle,
  CircleUser,
  CalendarCheck,
  Briefcase,
} from 'lucide-react';

export const getSidebarLinks = (userRole) => {
  if (userRole === 'Admin') {
    return [
      { href: '/admin', label: 'Dashboard', icon: Home },
      { href: '/admin/candidates', label: 'Candidates', icon: Users },
      { href: '/admin/recruiters', label: 'Team Management', icon: UserCheck },
      { href: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
      { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
      { href: '/admin/application-activity', label: 'Application Activity', icon: BarChart3 },
      { href: '/admin/reports', label: 'Reports', icon: FileText },
      { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
      { href: '/profile', label: 'My Profile', icon: CircleUser },
    ];
  }

  return [
    { href: '/recruiter', label: 'Dashboard', icon: Home },
    { href: '/recruiter/candidates', label: 'Candidates', icon: Users },
    { href: '/recruiter/candidates-kanban', label: 'Kanban Board', icon: Briefcase },
    { href: '/recruiter/applications', label: 'Applications', icon: FileText },
    { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
    { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
    { href: '/profile', label: 'My Profile', icon: CircleUser },
  ];
};
