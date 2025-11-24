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
} from 'lucide-react';

export const getAdminSidebarLinks = () => [
  { href: '/admin', label: 'Dashboard', icon: Home },
  { href: '/admin/candidates', label: 'Candidates', icon: Users },
  { href: '/admin/recruiters', label: 'Team Management', icon: UserCheck },
  { href: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
  { href: '/admin/application-activity', label: 'Application Activity', icon: BarChart3 },
  { href: '/recruiter/applications', label: 'Applications', icon: FileText },
  { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
  { href: '/profile', label: 'My Profile', icon: CircleUser },
];

