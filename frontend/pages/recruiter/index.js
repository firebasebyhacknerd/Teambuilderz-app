import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import { UserCheck, ChevronRight, LogOut } from 'lucide-react';
import { useRouter } from 'next/router';

const API_URL = typeof window !== 'undefined' ? 'http://localhost:3001' : 'http://tbz_backend:3001';
const DAILY_TARGET = 60;

const RecruiterDashboard = () => {
  const router = useRouter();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weeklyAvg, setWeeklyAvg] = useState(0);
  const [monthlyAvg, setMonthlyAvg] = useState(0);
  const userName = typeof window !== 'undefined' ? localStorage.getItem('userName') : 'Recruiter';
  const totalAppsToday = candidates.reduce((sum, c) => sum + parseInt(c.daily_applications || 0), 0);
  const progressPercent = Math.min(100, (totalAppsToday / DAILY_TARGET) * 100);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    const fetchCandidates = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/candidates`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.status === 401 || response.status === 403) {
            router.push('/login');
            return;
        }
        if (!response.ok) throw new Error("Failed to fetch candidates.");
        setCandidates(await response.json());
      } catch (error) {
        console.error(error.message);
      } finally {
        setLoading(false);
      }
    };

    // Weekly and monthly averages for this recruiter
    const fetchAverages = async () => {
      try {
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 6);
        const weekFrom = weekAgo.toISOString().split('T')[0];
        const weekTo = today.toISOString().split('T')[0];
        const monthFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const monthTo = today.toISOString().split('T')[0];
        const token = localStorage.getItem('token');
        // Weekly
        const weekRes = await fetch(`${API_URL}/api/v1/reports/performance?date_from=${weekFrom}&date_to=${weekTo}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const weekData = await weekRes.json();
        // Monthly
        const monthRes = await fetch(`${API_URL}/api/v1/reports/performance?date_from=${monthFrom}&date_to=${monthTo}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const monthData = await monthRes.json();
        // Find this recruiter (by userName)
        const recruiterName = localStorage.getItem('userName');
        const weekRec = weekData.find(r => r.recruiter_name === recruiterName);
        const monthRec = monthData.find(r => r.recruiter_name === recruiterName);
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

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-gray-50/50 backdrop-blur-sm p-4 md:p-8">
      <Header title="My Candidate Pipeline" userName={userName} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <Card className="p-8 flex flex-col items-center col-span-1 lg:col-span-2">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">Daily Application Target</h2>
            <ProgressRing percentage={progressPercent} value={totalAppsToday} target={DAILY_TARGET} />
            <p className="mt-4 text-center text-gray-600">
                You have logged <span className="font-bold text-blue-600">{totalAppsToday}</span> out of the <span className="font-bold">{DAILY_TARGET}</span> applications required today.
            </p>
            <div className="flex flex-col md:flex-row gap-4 mt-6 w-full justify-center">
              <div className="bg-yellow-100 rounded-lg px-4 py-2 text-center w-full md:w-1/2">
                <span className="block text-sm text-gray-700">Weekly Avg Apps/Day</span>
                <span className="text-xl font-bold text-yellow-700">{weeklyAvg}</span>
              </div>
              <div className="bg-pink-100 rounded-lg px-4 py-2 text-center w-full md:w-1/2">
                <span className="block text-sm text-gray-700">Monthly Avg Apps/Day</span>
                <span className="text-xl font-bold text-pink-700">{monthlyAvg}</span>
              </div>
            </div>
        </Card>

        <Card className="p-0 col-span-1">
            <h2 className="px-6 py-4 text-xl font-bold text-gray-800 border-b border-gray-200">My Candidates</h2>
            <div className="divide-y divide-gray-200">
                {candidates.length === 0 && <p className="p-4 text-gray-500">No candidates assigned yet.</p>}
                {candidates.map(c => (
                    <CandidateListItem key={c.id} candidate={c} onClick={() => router.push(`/recruiter/candidate/${c.id}`)} />
                ))}
            </div>
        </Card>
      </div>
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
          <p className="text-sm font-medium text-gray-500">Hello,</p>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">{userName}</h1>
          <p className="mt-1 text-xl text-gray-600">{title}</p>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </div>
  );
};

const CandidateListItem = ({ candidate, onClick }) => (
    <div onClick={onClick} className="flex justify-between items-center px-6 py-3 hover:bg-white/90 transition duration-150 ease-in-out cursor-pointer">
        <div className="flex flex-col">
            <span className="font-semibold text-gray-800">{candidate.name}</span>
            <span className="text-sm text-gray-500">{candidate.technology_primary || 'N/A'}</span>
        </div>
        <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-blue-600">{candidate.daily_applications || 0} Apps Today</span>
            <ChevronRight size={18} className="text-gray-400" />
        </div>
    </div>
);


const ProgressRing = ({ percentage, value, target }) => {
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <svg className="w-40 h-40 transform -rotate-90">
            <circle
                className="text-gray-200"
                strokeWidth="10"
                stroke="currentColor"
                fill="transparent"
                r={radius}
                cx="80"
                cy="80"
            />
            <circle
                className="text-blue-600 transition-all duration-1000 ease-in-out"
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
             <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" 
                   className="text-4xl font-bold text-gray-900 rotate-90 transform translate-x-[-12px] translate-y-[-10px]">{Math.round(percentage)}%</text>
             <text x="50%" y="70%" dominantBaseline="middle" textAnchor="middle" 
                   className="text-sm text-gray-500 rotate-90 transform translate-x-[-12px] translate-y-[-10px]">{value}/{target}</text>
        </svg>
    );
};

export default RecruiterDashboard;
