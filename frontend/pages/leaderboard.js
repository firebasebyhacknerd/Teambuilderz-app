import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { Trophy, TrendingUp, Users, Target, Flame, Award, Home, FileText, AlertTriangle, UserCheck } from 'lucide-react';
import DashboardLayout from '../components/Layout/DashboardLayout';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useLeaderboardQuery } from '../lib/queryHooks';

const LeaderboardPage = () => {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [userRole, setUserRole] = useState('Recruiter');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedRole = localStorage.getItem('userRole');
    const storedName = localStorage.getItem('userName');

    if (!storedToken) {
      router.push('/login');
      return;
    }

    setToken(storedToken);
    if (storedRole) {
      setUserRole(storedRole);
    }
    if (storedName) {
      setUserName(storedName);
    }
  }, [router]);

  const { data, isLoading } = useLeaderboardQuery(token, Boolean(token));
  const leaderboard = data?.leaderboard ?? [];
  const generatedAt = data?.generatedAt ?? null;

  const sidebarLinks = useMemo(() => {
    if (userRole === 'Admin') {
      return [
        { href: '/admin', label: 'Dashboard', icon: Home },
        { href: '/admin/candidates', label: 'Candidates', icon: Users },
        { href: '/admin/recruiters', label: 'Team Management', icon: UserCheck },
        { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
        { href: '/recruiter/applications', label: 'Applications', icon: FileText },
        { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
      ];
    }

    return [
      { href: '/recruiter', label: 'Dashboard', icon: Home },
      { href: '/recruiter/candidates', label: 'Candidates', icon: Users },
      { href: '/recruiter/applications', label: 'Applications', icon: FileText },
      { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
      { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
    ];
  }, [userRole]);

  const topPerformer = leaderboard[0];

  const summary = useMemo(() => {
    const totalApplicationsWeek = leaderboard.reduce((sum, entry) => sum + entry.weekApplications, 0);
    const totalToday = leaderboard.reduce((sum, entry) => sum + entry.todayApplications, 0);
    const activeRecruiters = leaderboard.length;
    return {
      totalApplicationsWeek,
      totalToday,
      activeRecruiters,
    };
  }, [leaderboard]);

  return (
    <DashboardLayout
      title="Recruiter Leaderboard"
      subtitle={generatedAt ? `Refreshed ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(generatedAt))}` : 'Performance snapshot across the team'}
      links={sidebarLinks}
    >
      {isLoading ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground">Loading leaderboard...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryCard
              icon={<TrendingUp className="h-5 w-5 text-primary" />}
              title="Team Applications (7 days)"
              value={summary.totalApplicationsWeek}
              accent="bg-primary/10 text-primary"
            />
            <SummaryCard
              icon={<Target className="h-5 w-5 text-emerald-600" />}
              title="Applications Today"
              value={summary.totalToday}
              accent="bg-emerald-100 text-emerald-700"
            />
            <SummaryCard
              icon={<Users className="h-5 w-5 text-purple-600" />}
              title="Active Recruiters"
              value={summary.activeRecruiters}
              accent="bg-purple-100 text-purple-700"
            />
          </div>

          {topPerformer && (
            <Card className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-amber-100 via-white to-amber-100 border-amber-200">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Trophy className="h-7 w-7 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase">Top Performer</p>
                  <p className="text-xl font-semibold text-foreground">{topPerformer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {topPerformer.weekApplications} applications this week · {topPerformer.todayApplications} today
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex flex-col text-right">
                  <span className="text-xs uppercase">Active Candidates</span>
                  <span className="text-lg font-semibold text-foreground">{topPerformer.activeCandidates}</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-xs uppercase">Daily Quota</span>
                  <span className="text-lg font-semibold text-foreground">{topPerformer.dailyQuota}</span>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <th className="px-6 py-3">Rank</th>
                    <th className="px-6 py-3">Recruiter</th>
                    <th className="px-6 py-3">Today</th>
                    <th className="px-6 py-3">7 Days</th>
                    <th className="px-6 py-3">30 Days</th>
                    <th className="px-6 py-3">Active Candidates</th>
                    <th className="px-6 py-3">Notes (7d)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {leaderboard.map((entry) => (
                    <tr key={entry.recruiterId} className="hover:bg-muted/30 transition">
                      <td className="px-6 py-3">
                        <Badge variant={entry.rank === 1 ? 'default' : 'outline'} className="gap-1">
                          #{entry.rank}
                          {entry.rank === 1 && <Award className="h-3 w-3" />}
                        </Badge>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground">{entry.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {entry.totalApplications} lifetime apps · quota {entry.dailyQuota}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-foreground">{entry.todayApplications}</td>
                      <td className="px-6 py-3 text-sm text-foreground">{entry.weekApplications}</td>
                      <td className="px-6 py-3 text-sm text-foreground">{entry.monthApplications}</td>
                      <td className="px-6 py-3 text-sm text-foreground">{entry.activeCandidates}</td>
                      <td className="px-6 py-3 text-sm text-foreground">{entry.notesLast7Days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {leaderboard.length === 0 && (
              <div className="py-12 text-center space-y-2">
                <TrendingUp size={40} className="mx-auto text-muted-foreground" />
                <h3 className="text-lg font-medium text-foreground">No recruiter activity yet</h3>
                <p className="text-sm text-muted-foreground">Once applications start flowing in, the leaderboard will light up.</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
};

const SummaryCard = ({ icon, title, value, accent }) => (
  <Card className="p-5 flex items-center gap-3">
    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${accent ?? 'bg-muted text-foreground'}`}>
      {icon}
    </div>
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </div>
  </Card>
);

export default LeaderboardPage;


