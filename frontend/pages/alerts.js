import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Calendar,
  Home,
  Users,
  FileText,
  CircleUser
} from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import DashboardLayout from '../components/Layout/DashboardLayout';
import API_URL from '../lib/api';

const AlertsPage = () => {
  const router = useRouter();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [processingAlertId, setProcessingAlertId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [userRole, setUserRole] = useState('Admin');

  const fetchAlerts = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      setLoading(true);
      setActionError('');

      const response = await fetch(`${API_URL}/api/v1/alerts`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401 || response.status === 403) {
        router.push('/login');
        return;
      }

      const data = await response.json();
      setAlerts(data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      setActionError('Unable to load alerts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('userRole');
      if (storedRole) setUserRole(storedRole);
    }
    fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAlerts = useMemo(
    () => alerts.filter((alert) => (!statusFilter ? true : alert.status === statusFilter)),
    [alerts, statusFilter]
  );

  const sidebarLinks = useMemo(() => {
    if (userRole === 'Recruiter') {
      return [
        { href: '/recruiter', label: 'Dashboard', icon: Home },
        { href: '/recruiter/applications', label: 'Applications', icon: FileText },
        { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
        { href: '/profile', label: 'My Profile', icon: CircleUser },
      ];
    }

    return [
      { href: '/admin', label: 'Dashboard', icon: Home },
      { href: '/admin/candidates', label: 'Candidates', icon: Users },
      { href: '/recruiter/applications', label: 'Applications', icon: FileText },
      { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
      { href: '/profile', label: 'My Profile', icon: CircleUser },
    ];
  }, [userRole]);

  const getAlertIcon = (alertType) => {
    const icons = {
      quota_breach: <Target size={20} />,
      assessment_due: <Clock size={20} />,
      interview_reminder: <Calendar size={20} />,
      backup_failure: <AlertTriangle size={20} />
    };
    return icons[alertType] || <Bell size={20} />;
  };

  const getAlertColor = (alertType, status) => {
    if (status === 'resolved') return 'bg-gray-100 text-gray-600';

    const colors = {
      quota_breach: 'bg-red-100 text-red-800',
      assessment_due: 'bg-yellow-100 text-yellow-800',
      interview_reminder: 'bg-blue-100 text-blue-800',
      backup_failure: 'bg-red-100 text-red-800'
    };
    return colors[alertType] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      1: 'text-red-600',
      2: 'text-yellow-600',
      3: 'text-blue-600'
    };
    return colors[priority] || 'text-gray-600';
  };

  const handleAlertAction = async (alertId, action) => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      setProcessingAlertId(alertId);
      setActionError('');

      const response = await fetch(`${API_URL}/api/v1/alerts/${alertId}/${action}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Unable to update alert.');
      }

      const updatedAlert = await response.json();
      setAlerts((prev) => prev.map((alert) => (alert.id === updatedAlert.id ? updatedAlert : alert)));
    } catch (error) {
      console.error(`Error updating alert (${action}):`, error);
      setActionError(error.message);
    } finally {
      setProcessingAlertId(null);
    }
  };

  const handleAcknowledge = (alertId) => handleAlertAction(alertId, 'acknowledge');

  const handleResolve = (alertId) => handleAlertAction(alertId, 'resolve');

  if (loading) {
    return (
      <DashboardLayout title="Alerts & Notifications" subtitle="Monitoring system events" links={sidebarLinks}>
        <div className="h-48 flex items-center justify-center text-muted-foreground">Loading alerts…</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Alerts & Notifications"
      subtitle="Stay ahead of quota breaches, assessment deadlines, and interview reminders."
      links={sidebarLinks}
    >
      {actionError && (
        <div className="mb-6 text-sm text-red-600 bg-red-100/80 border border-red-200 rounded-lg p-3">{actionError}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon={<Bell size={24} />} title="Total Alerts" value={alerts.length} color="bg-blue-100 text-blue-600" />
        <SummaryCard
          icon={<AlertTriangle size={24} />}
          title="Open"
          value={alerts.filter((a) => a.status === 'open').length}
          color="bg-red-100 text-red-600"
        />
        <SummaryCard
          icon={<Clock size={24} />}
          title="Acknowledged"
          value={alerts.filter((a) => a.status === 'acknowledged').length}
          color="bg-yellow-100 text-yellow-600"
        />
        <SummaryCard
          icon={<CheckCircle size={24} />}
          title="Resolved"
          value={alerts.filter((a) => a.status === 'resolved').length}
          color="bg-green-100 text-green-600"
        />
      </div>

      <Card className="p-6 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">Filter by status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
          <Button variant="ghost" onClick={() => setStatusFilter('')}>
            Reset
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <Card className="p-12 text-center">
            <Bell size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No alerts found</h3>
            <p className="text-muted-foreground">You&apos;re all caught up! No alerts to show.</p>
          </Card>
        ) : (
          filteredAlerts.map((alert) => (
            <Card
              key={alert.id}
              className={`p-6 border-l-4 ${
                alert.status === 'open'
                  ? 'border-l-red-500'
                  : alert.status === 'acknowledged'
                  ? 'border-l-yellow-500'
                  : 'border-l-green-500'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-full ${getAlertColor(alert.alert_type, alert.status)}`}>
                    {getAlertIcon(alert.alert_type)}
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{alert.title}</h3>
                      <span className={`text-xs font-medium ${getPriorityColor(alert.priority)}`}>Priority {alert.priority}</span>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          alert.status === 'open'
                            ? 'bg-red-100 text-red-800'
                            : alert.status === 'acknowledged'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {alert.status}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{alert.message}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>Type: {alert.alert_type.replace('_', ' ')}</span>
                      <span>•</span>
                      <span>Created: {new Date(alert.created_at).toLocaleString()}</span>
                      {alert.acknowledged_at && (
                        <>
                          <span>•</span>
                          <span>Acknowledged: {new Date(alert.acknowledged_at).toLocaleString()}</span>
                        </>
                      )}
                      {alert.resolved_at && (
                        <>
                          <span>•</span>
                          <span>Resolved: {new Date(alert.resolved_at).toLocaleString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {alert.status === 'open' && (
                    <Button variant="outline" disabled={processingAlertId === alert.id} onClick={() => handleAcknowledge(alert.id)}>
                      {processingAlertId === alert.id ? 'Updating…' : 'Acknowledge'}
                    </Button>
                  )}
                  {alert.status === 'acknowledged' && (
                    <Button disabled={processingAlertId === alert.id} onClick={() => handleResolve(alert.id)}>
                      {processingAlertId === alert.id ? 'Updating…' : 'Resolve'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
};

const SummaryCard = ({ icon, title, value, color }) => (
  <Card className="p-6 flex items-center gap-3">
    <div className={`w-11 h-11 rounded-full flex items-center justify-center ${color}`}>{icon}</div>
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  </Card>
);

export default AlertsPage;

