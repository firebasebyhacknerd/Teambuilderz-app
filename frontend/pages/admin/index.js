import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { Users, Briefcase, ChevronRight, BarChart3, Target, UserPlus, FileText, Calendar, AlertTriangle, Settings, Plus, LogOut } from 'lucide-react';
import { useRouter } from 'next/router';
import API_URL from '../../lib/api';

const AdminDashboard = () => {
  const router = useRouter();
  const [candidates, setCandidates] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [weeklyPerformance, setWeeklyPerformance] = useState([]);
  const [monthlyPerformance, setMonthlyPerformance] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const userName = typeof window !== 'undefined' ? localStorage.getItem('userName') : 'Admin';

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

    Promise.all([
      fetchData('/api/v1/candidates', setCandidates),
      fetchData('/api/v1/reports/performance', setPerformance),
      fetchData(`/api/v1/reports/performance?date_from=${weekFrom}&date_to=${weekTo}`, setWeeklyPerformance),
      fetchData(`/api/v1/reports/performance?date_from=${monthFrom}&date_to=${monthTo}`, setMonthlyPerformance),
      fetchData('/api/v1/alerts', setAlerts)
    ]).finally(() => setLoading(false));

  }, [router]);

  const totalCandidates = candidates.length;
  const totalRecruiters = performance.length;
  const totalApplications = performance.reduce((sum, r) => sum + parseInt(r.apps_total_period || 0), 0);
  const totalAppsToday = performance.reduce((sum, r) => sum + parseInt(r.avg_apps_per_day || 0), 0);
  const openAlerts = alerts.filter(a => a.status === 'open').length;

  // Calculate weekly and monthly averages for all recruiters
  const weeklyAvg = weeklyPerformance.length > 0 ? Math.round(weeklyPerformance.reduce((sum, r) => sum + parseFloat(r.avg_apps_per_day || 0), 0) / weeklyPerformance.length) : 0;
  const monthlyAvg = monthlyPerformance.length > 0 ? Math.round(monthlyPerformance.reduce((sum, r) => sum + parseFloat(r.avg_apps_per_day || 0), 0) / monthlyPerformance.length) : 0;


  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading Admin Dashboard...</div>;

  return (
    <div className="min-h-screen bg-gray-50/50 backdrop-blur-sm p-4 md:p-8">
      <Header title="Admin Dashboard" userName={userName} />

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-10">
        <KpiCard icon={<Users />} title="Total Candidates" value={totalCandidates} color="bg-blue-500" />
        <KpiCard icon={<Briefcase />} title="Total Recruiters" value={totalRecruiters} color="bg-green-500" />
        <KpiCard icon={<BarChart3 />} title="Total Applications" value={totalApplications} color="bg-purple-500" />
        <KpiCard icon={<Target />} title="Weekly Avg Apps/Day" value={weeklyAvg} color="bg-yellow-500" />
        <KpiCard icon={<Target />} title="Monthly Avg Apps/Day" value={monthlyAvg} color="bg-pink-500" />
        <KpiCard icon={<AlertTriangle />} title="Open Alerts" value={openAlerts} color="bg-red-500" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <QuickActionCard
          icon={<UserPlus />}
          title="Manage Candidates"
          description="Add, edit, and track candidates"
          onClick={() => router.push('/admin/candidates')}
          color="bg-blue-500"
        />
        <QuickActionCard
          icon={<FileText />}
          title="View Applications"
          description="Track all job applications"
          onClick={() => router.push('/recruiter/applications')}
          color="bg-green-500"
        />
        <QuickActionCard
          icon={<Calendar />}
          title="Schedule Interviews"
          description="Manage interview schedules"
          onClick={() => router.push('/recruiter/interviews')}
          color="bg-purple-500"
        />
        <QuickActionCard
          icon={<AlertTriangle />}
          title="View Alerts"
          description="Check notifications and alerts"
          onClick={() => router.push('/alerts')}
          color="bg-red-500"
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
    </div>
  );
};

const Header = ({ title, userName }) => {
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    window.location.href = '/login';
  };

  return (
    <div className="mb-8 pt-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500">Welcome back,</p>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">{userName}</h1>
          <p className="mt-1 text-xl text-gray-600">{title}</p>
        </div>
        <Button 
          onClick={handleLogout}
          variant="outline"
          className="flex items-center gap-2"
        >
          <LogOut size={16} />
          Logout
        </Button>
      </div>
    </div>
  );
};

const KpiCard = ({ icon, title, value, color }) => (
    <Card className="flex items-center space-x-4 p-4">
        <div className={`p-3 rounded-xl text-white ${color}`}>
            {React.cloneElement(icon, { size: 24 })}
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
    </Card>
);

const QuickActionCard = ({ icon, title, description, onClick, color }) => (
    <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow duration-200" onClick={onClick}>
        <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-xl text-white ${color}`}>
                {React.cloneElement(icon, { size: 24 })}
            </div>
            <div>
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-500">{description}</p>
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
