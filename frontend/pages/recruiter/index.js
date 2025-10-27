import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { UserCheck, ChevronRight, LogOut, Users, FileText, AlertTriangle, Home } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import API_URL from '../../lib/api';

const DAILY_TARGET = 60;

const RecruiterDashboard = () => {
  const router = useRouter();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weeklyAvg, setWeeklyAvg] = useState(0);
  const [monthlyAvg, setMonthlyAvg] = useState(0);
  const [userName, setUserName] = useState('Recruiter');

  const totalAppsToday = useMemo(
    () => candidates.reduce((sum, c) => sum + parseInt(c.daily_applications || 0, 10), 0),
    [candidates]
  );
  const progressPercent = Math.min(100, (totalAppsToday / DAILY_TARGET) * 100);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const storedName = localStorage.getItem('userName');
    if (storedName) setUserName(storedName);

    const fetchCandidates = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/candidates`, { headers: { Authorization: `Bearer ${token}` } });
        if (response.status === 401 || response.status === 403) {
          router.push('/login');
          return;
        }
        if (!response.ok) throw new Error('Failed to fetch candidates.');
        setCandidates(await response.json());
      } catch (error) {
        console.error(error.message);
      } finally {
        setLoading(false);
      }
    };

    const fetchAverages = async () => {
      try {
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 6);
        const weekFrom = weekAgo.toISOString().split('T')[0];
        const weekTo = today.toISOString().split('T')[0];
        const monthFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const monthTo = today.toISOString().split('T')[0];

        const headers = { Authorization: `Bearer ${token}` };

        const [weekRes, monthRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/reports/performance?date_from=${weekFrom}&date_to=${weekTo}`, { headers }),
          fetch(`${API_URL}/api/v1/reports/performance?date_from=${monthFrom}&date_to=${monthTo}`, { headers })
        ]);

        const [weekData, monthData] = await Promise.all([weekRes.json(), monthRes.json()]);
        const weekRec = weekData.find((r) => r.recruiter_name === (storedName || ''));
        const monthRec = monthData.find((r) => r.recruiter_name === (storedName || ''));
        setWeeklyAvg(weekRec ? Math.round(weekRec.avg_apps_per_day || 0) : 0);
        setMonthlyAvg(monthRec ? Math.round(monthRec.avg_apps_per_day || 0) : 0);
      } catch (error) {
        setWeeklyAvg(0);
        setMonthlyAvg(0);
      }
    };

    fetchCandidates();
    fetchAverages();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    router.push('/login');
  };

  const sidebarLinks = [
    { href: '/recruiter', label: 'Dashboard', icon: Home },
    { href: '/recruiter/candidates', label: 'Candidates', icon: Users },
    { href: '/recruiter/applications', label: 'Applications', icon: FileText },
    { href: '/alerts', label: 'Alerts', icon: AlertTriangle }
  ];

  if (loading) {
    return (
      <DashboardLayout title="Recruiter Dashboard" subtitle={`Welcome back, ${userName}`} links={sidebarLinks}>
        <div className="h-48 flex items-center justify-center text-muted-foreground">Loading dashboard…</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Recruiter Dashboard"
      subtitle={`Welcome back, ${userName}`}
      links={sidebarLinks}
      actions={
        <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
          <LogOut size={16} />
          Logout
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="p-6 lg:col-span-2 space-y-6">
          <div className="flex items-center gap-3">
            <UserCheck className="text-primary h-6 w-6" />
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Daily Application Target</p>
              <h2 className="text-2xl font-semibold text-foreground">Today&apos;s Progress</h2>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            <ProgressRing percentage={progressPercent} value={totalAppsToday} target={DAILY_TARGET} />
            <p className="text-center text-muted-foreground">
              You have logged{' '}
              <span className="font-semibold text-primary">{totalAppsToday}</span> of{' '}
              <span className="font-semibold">{DAILY_TARGET}</span> applications required today.
            </p>
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3">
              <HighlightCard title="Weekly Avg Apps/Day" value={weeklyAvg} tone="from-yellow-100 to-yellow-200" />
              <HighlightCard title="Monthly Avg Apps/Day" value={monthlyAvg} tone="from-pink-100 to-pink-200" />
            </div>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">My Candidates</h2>
            <p className="text-xs text-muted-foreground">Quick access to your active pipeline</p>
          </div>
          <div className="divide-y divide-border">
            {candidates.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No candidates assigned yet.</p>
            ) : (
              candidates.map((candidate) => (
                <CandidateListItem
                  key={candidate.id}
                  candidate={candidate}
                  onClick={() => router.push(`/recruiter/candidate/${candidate.id}`)}
                />
              ))
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

const HighlightCard = ({ title, value, tone }) => (
  <div className={`rounded-lg bg-gradient-to-br ${tone} px-4 py-3 text-center shadow-sm`}>
    <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
    <span className="text-xl font-semibold text-foreground">{value}</span>
  </div>
);

const CandidateListItem = ({ candidate, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center justify-between px-6 py-3 hover:bg-accent transition text-left"
  >
    <div>
      <p className="text-sm font-semibold text-foreground">{candidate.name}</p>
      <p className="text-xs text-muted-foreground">{candidate.technology_primary || 'N/A'}</p>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-primary">{candidate.daily_applications || 0} Apps Today</span>
      <ChevronRight size={18} className="text-muted-foreground" />
    </div>
  </button>
);

const ProgressRing = ({ percentage, value, target }) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg className="w-40 h-40 transform -rotate-90 text-primary">
      <circle
        className="text-muted stroke-current"
        strokeWidth="10"
        stroke="currentColor"
        fill="transparent"
        r={radius}
        cx="80"
        cy="80"
      />
      <circle
        className="stroke-current transition-all duration-1000 ease-in-out"
        strokeWidth="10"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        stroke="currentColor"
        fill="transparent"
        r={radius}
        cx="80"
        cy="80"
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        className="text-3xl font-semibold text-foreground rotate-90 transform translate-x-[-8px]"
      >
        {Math.round(percentage)}%
      </text>
      <text
        x="50%"
        y="68%"
        dominantBaseline="middle"
        textAnchor="middle"
        className="text-xs text-muted-foreground rotate-90 transform translate-x-[-8px]"
      >
        {value}/{target}
      </text>
    </svg>
  );
};

export default RecruiterDashboard;
