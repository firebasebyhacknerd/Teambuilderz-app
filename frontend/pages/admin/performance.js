import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { TrendingUp, Users, Calendar, Download, BarChart3, PieChart, Activity } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import PDFExportButton from '../../components/ui/pdf-export-button';
import PDFExportPanel from '../../components/ui/pdf-export-panel';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import API_URL from '../../lib/api';

const PerformancePage = () => {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [userName, setUserName] = useState('Admin');
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [showExportPanel, setShowExportPanel] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedRole = localStorage.getItem('userRole');
    const storedName = localStorage.getItem('userName');
    
    if (!storedToken) {
      router.push('/login');
      return;
    }
    
    if (storedRole !== 'Admin') {
      router.replace('/recruiter');
      return;
    }
    
    setToken(storedToken);
    setUserName(storedName || 'Admin');
  }, [router]);

  useEffect(() => {
    if (!token) return;
    
    const fetchPerformanceData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/reports/performance`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setPerformanceData(data);
        }
      } catch (error) {
        console.error('Error fetching performance data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPerformanceData();
  }, [token]);

  const getAdminSidebarLinks = () => [
    { href: '/admin', label: 'Dashboard', icon: TrendingUp },
    { href: '/admin/candidates', label: 'Candidates', icon: Users },
    { href: '/admin/attendance', label: 'Attendance', icon: Calendar },
    { href: '/admin/performance', label: 'Performance', icon: BarChart3 },
    { href: '/admin/reports', label: 'Reports', icon: Download },
    { href: '/alerts', label: 'Alerts', icon: Activity },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    router.push('/login');
  };

  const calculateMetrics = (data) => {
    if (!data || !data.recruiters) return { total: 0, avgApps: 0, avgInterviews: 0, avgPlacements: 0 };
    
    const recruiters = data.recruiters;
    const total = recruiters.length;
    const avgApps = Math.round(recruiters.reduce((sum, r) => sum + (r.applications || 0), 0) / total);
    const avgInterviews = Math.round(recruiters.reduce((sum, r) => sum + (r.interviews || 0), 0) / total);
    const avgPlacements = Math.round(recruiters.reduce((sum, r) => sum + (r.placements || 0), 0) / total);
    
    return { total, avgApps, avgInterviews, avgPlacements };
  };

  const getPerformanceCategory = (placements, applications) => {
    if (!applications || applications === 0) return 'No Data';
    const conversionRate = (placements / applications) * 100;
    
    if (conversionRate >= 15) return { category: 'Excellent', color: 'bg-emerald-100 text-emerald-800' };
    if (conversionRate >= 10) return { category: 'Good', color: 'bg-blue-100 text-blue-800' };
    if (conversionRate >= 5) return { category: 'Average', color: 'bg-yellow-100 text-yellow-800' };
    return { category: 'Poor', color: 'bg-red-100 text-red-800' };
  };

  const metrics = calculateMetrics(performanceData);

  return (
    <DashboardLayout
      title="Performance Analytics"
      subtitle="Recruiter performance metrics and conversion rates"
      links={getAdminSidebarLinks()}
      actions={
        <div className="flex gap-2">
          <PDFExportButton
            reportType="performance"
            data={{ period: selectedPeriod }}
            filename="performance-analytics"
            variant="outline"
            size="sm"
          />
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Recruiters</p>
                <p className="text-2xl font-bold">{metrics.total}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Applications</p>
                <p className="text-2xl font-bold">{metrics.avgApps}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-500" />
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Interviews</p>
                <p className="text-2xl font-bold">{metrics.avgInterviews}</p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Placements</p>
                <p className="text-2xl font-bold">{metrics.avgPlacements}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </Card>
        </div>

        {/* Period Selector */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Performance Period</h3>
              <p className="text-sm text-muted-foreground">Select time period for analysis</p>
            </div>
            <div className="flex gap-2">
              {['weekly', 'monthly', 'quarterly', 'yearly'].map(period => (
                <Button
                  key={period}
                  variant={selectedPeriod === period ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPeriod(period)}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Performance Table */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Recruiter Performance Details</h3>
            <Button
              variant="outline"
              onClick={() => setShowExportPanel(!showExportPanel)}
            >
              <Download className="h-4 w-4 mr-2" />
              Advanced Export
            </Button>
          </div>
          
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading performance data...</p>
            </div>
          ) : performanceData?.recruiters ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Recruiter</th>
                    <th className="text-center py-3 px-4 font-medium">Applications</th>
                    <th className="text-center py-3 px-4 font-medium">Interviews</th>
                    <th className="text-center py-3 px-4 font-medium">Placements</th>
                    <th className="text-center py-3 px-4 font-medium">Conversion Rate</th>
                    <th className="text-center py-3 px-4 font-medium">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceData.recruiters
                    .sort((a, b) => (b.placements || 0) - (a.placements || 0))
                    .map((recruiter, index) => {
                      const conversionRate = recruiter.applications > 0 
                        ? ((recruiter.placements / recruiter.applications) * 100).toFixed(1)
                        : '0';
                      const performance = getPerformanceCategory(recruiter.placements, recruiter.applications);
                      
                      return (
                        <tr key={recruiter.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium">{recruiter.name}</p>
                              <p className="text-sm text-muted-foreground">{recruiter.email}</p>
                            </div>
                          </td>
                          <td className="text-center py-3 px-4">
                            <span className="font-medium">{recruiter.applications || 0}</span>
                          </td>
                          <td className="text-center py-3 px-4">
                            <span className="font-medium">{recruiter.interviews || 0}</span>
                          </td>
                          <td className="text-center py-3 px-4">
                            <span className="font-medium text-green-600">{recruiter.placements || 0}</span>
                          </td>
                          <td className="text-center py-3 px-4">
                            <span className="font-medium">{conversionRate}%</span>
                          </td>
                          <td className="text-center py-3 px-4">
                            <Badge className={performance.color}>
                              {performance.category}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No performance data available</p>
            </div>
          )}
        </Card>

        {/* Advanced Export Panel */}
        {showExportPanel && (
          <PDFExportPanel
            reportType="performance"
            className="max-w-2xl mx-auto"
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default PerformancePage;



