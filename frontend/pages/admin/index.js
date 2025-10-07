import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Users,
  Briefcase,
  ChevronRight,
  BarChart3,
  Target,
  UserPlus,
  FileText,
  Calendar,
  AlertTriangle,
  Home,
  LogOut
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import API_URL from '../../lib/api';
import DashboardLayout from '../../components/Layout/DashboardLayout';

const AdminDashboard = () => {
  const router = useRouter();
  const [candidates, setCandidates] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [weeklyPerformance, setWeeklyPerformance] = useState([]);
  const [monthlyPerformance, setMonthlyPerformance] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('Admin');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchData = async (endpoint, setter) => {
      try {
        const response = await fetch(`${API_URL}${endpoint}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.status === 403 || response.status === 401) {
            router.push('/login');
            return;
        }
        const data = await response.json();
        setter(data);
      } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error.message);
      }
    };

    // Weekly: last 7 days
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);
    const weekFrom = weekAgo.toISOString().split('T')[0];
    const weekTo = today.toISOString().split('T')[0];

    // Monthly: first day of month to today
    const monthFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const monthTo = today.toISOString().split('T')[0];

    const loadUserName = () => {
      const storedName = localStorage.getItem('userName');
      if (storedName) {
        setUserName(storedName);
      }
    };

    Promise.all([
      fetchData('/api/v1/candidates', setCandidates),
      fetchData('/api/v1/reports/performance', setPerformance),
      fetchData(`/api/v1/reports/performance?date_from=${weekFrom}&date_to=${weekTo}`, setWeeklyPerformance),
      fetchData(`/api/v1/reports/performance?date_from=${monthFrom}&date_to=${monthTo}`, setMonthlyPerformance),
      fetchData('/api/v1/alerts', setAlerts)
    ])
      .finally(() => setLoading(false));

    loadUserName();

  }, [router]);

  const totalCandidates = candidates.length;
  const totalRecruiters = performance.length;
  const totalApplications = performance.reduce((sum, r) => sum + parseInt(r.apps_total_period || 0), 0);
  const openAlerts = alerts.filter(a => a.status === 'open').length;

  // Calculate weekly and monthly averages for all recruiters
  const weeklyAvg = weeklyPerformance.length > 0 ? Math.round(weeklyPerformance.reduce((sum, r) => sum + parseFloat(r.avg_apps_per_day || 0), 0) / weeklyPerformance.length) : 0;
  const monthlyAvg = monthlyPerformance.length > 0 ? Math.round(monthlyPerformance.reduce((sum, r) => sum + parseFloat(r.avg_apps_per_day || 0), 0) / monthlyPerformance.length) : 0;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    router.push('/login');
  };

  const sidebarLinks = [
    { href: '/admin', label: 'Dashboard', icon: Home },
    { href: '/admin/candidates', label: 'Candidates', icon: Users },
    { href: '/recruiter/applications', label: 'Applications', icon: FileText },
    { href: '/alerts', label: 'Alerts', icon: AlertTriangle }
  ];

  if (loading) {
    return (
      <DashboardLayout title="Admin Dashboard" subtitle={`Welcome back, ${userName}`} links={sidebarLinks}>
        <div className="h-48 flex items-center justify-center">
          <p className="text-gray-500">Loading dashboard…</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Admin Dashboard"
      subtitle={`Welcome back, ${userName}`}
      links={sidebarLinks}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
        <KpiCard icon={<Users className="h-5 w-5 text-blue-600" />} title="Total Candidates" value={totalCandidates} accent="bg-blue-100 text-blue-700" />
        <KpiCard icon={<Briefcase className="h-5 w-5 text-emerald-600" />} title="Total Recruiters" value={totalRecruiters} accent="bg-emerald-100 text-emerald-700" />
        <KpiCard icon={<BarChart3 className="h-5 w-5 text-purple-600" />} title="Total Applications" value={totalApplications} accent="bg-purple-100 text-purple-700" />
        <KpiCard icon={<Target className="h-5 w-5 text-yellow-600" />} title="Weekly Avg Apps/Day" value={weeklyAvg} accent="bg-yellow-100 text-yellow-700" />
        <KpiCard icon={<Target className="h-5 w-5 text-pink-600" />} title="Monthly Avg Apps/Day" value={monthlyAvg} accent="bg-pink-100 text-pink-700" />
        <KpiCard icon={<AlertTriangle className="h-5 w-5 text-red-600" />} title="Open Alerts" value={openAlerts} accent="bg-red-100 text-red-700" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <QuickActionCard
          icon={<UserPlus className="h-5 w-5 text-blue-600" />}
          title="Manage Candidates"
          description="Add, edit, and track candidates"
          onClick={() => router.push('/admin/candidates')}
          accent="bg-blue-100 text-blue-700"
        />
        <QuickActionCard
          icon={<FileText className="h-5 w-5 text-emerald-600" />}
          title="View Applications"
          description="Track all job applications"
          onClick={() => router.push('/recruiter/applications')}
          accent="bg-emerald-100 text-emerald-700"
        />
        <QuickActionCard
          icon={<Calendar className="h-5 w-5 text-purple-600" />}
          title="Schedule Interviews"
          description="Manage interview schedules"
          onClick={() => router.push('/recruiter/interviews')}
          accent="bg-purple-100 text-purple-700"
        />
        <QuickActionCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          title="View Alerts"
          description="Check notifications and alerts"
          onClick={() => router.push('/alerts')}
          accent="bg-red-100 text-red-700"
        />
      </div>

      <Card className="p-0">
        <h2 className="px-6 py-4 text-xl font-bold text-gray-800 border-b border-gray-200">Recruiter Performance</h2>
        <div className="divide-y divide-gray-200">
          {performance.length === 0 && <p className="p-4 text-gray-500">No recruiter data found.</p>}
          {performance.map((recruiter, index) => (
            <RecruiterListItem key={index} recruiter={recruiter} />
          ))}
        </div>
      </Card>
    </DashboardLayout>
  );
};

const KpiCard = ({ icon, title, value, accent }) => (
  <Card className="flex items-center gap-3 p-5">
    <div className={`h-11 w-11 rounded-full flex items-center justify-center ${accent}`}>
      {icon}
    </div>
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  </Card>
);

const QuickActionCard = ({ icon, title, description, onClick, accent }) => (
  <Card className="p-5 border-dashed hover:border-primary/40 transition-colors cursor-pointer" onClick={onClick}>
    <div className="flex items-center gap-3">
      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${accent}`}>{icon}</div>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  </Card>
);

const RecruiterListItem = ({ recruiter }) => {
    const isBelowTarget = recruiter.avg_apps_per_day < recruiter.daily_quota;
    return (
        <div className="flex justify-between items-center px-6 py-3 hover:bg-white/90 transition duration-150 ease-in-out cursor-pointer">
            <div className="flex flex-col">
                <span className="font-semibold text-gray-800">{recruiter.recruiter_name}</span>
                <span className="text-sm text-gray-500">Candidates: {recruiter.total_candidates}</span>
            </div>
            <div className="flex flex-col items-end">
                <span className={`text-sm font-medium ${isBelowTarget ? 'text-red-600' : 'text-green-600'}`}>
                    {Math.round(recruiter.avg_apps_per_day || 0)} / {recruiter.daily_quota} Avg Apps/Day
                </span>
                <span className="text-xs text-gray-500">{recruiter.apps_total_period || 0} Total Apps</span>
            </div>
            <ChevronRight size={18} className="text-gray-400 ml-4" />
        </div>
    );
};

export default AdminDashboard;
