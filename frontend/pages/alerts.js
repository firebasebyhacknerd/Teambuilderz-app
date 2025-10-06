import React, { useEffect, useState } from 'react';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import { Bell, AlertTriangle, CheckCircle, Clock, Target, Calendar, X } from 'lucide-react';
import { useRouter } from 'next/router';

const API_URL = process.env.NODE_ENV === 'production' ? 'http://tbz_backend:3001' : 'http://localhost:3001';

const AlertsPage = () => {
  const router = useRouter();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [processingAlertId, setProcessingAlertId] = useState(null);
  const [actionError, setActionError] = useState('');

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
    fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAlerts = alerts.filter(alert => 
    !statusFilter || alert.status === statusFilter
  );

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
      setAlerts((prev) =>
        prev.map((alert) => (alert.id === updatedAlert.id ? updatedAlert : alert))
      );
    } catch (error) {
      console.error(`Error updating alert (${action}):`, error);
      setActionError(error.message);
    } finally {
      setProcessingAlertId(null);
    }
  };

  const handleAcknowledge = (alertId) => handleAlertAction(alertId, 'acknowledge');

  const handleResolve = (alertId) => handleAlertAction(alertId, 'resolve');

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading alerts...</div>;

  return (
    <div className="min-h-screen bg-gray-50/50 backdrop-blur-sm p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Alerts & Notifications</h1>
        <p className="text-gray-600 mt-2">Stay updated with important notifications and alerts</p>
      </div>

      {actionError && (
        <div className="mb-6 text-sm text-red-600 bg-red-100/80 border border-red-200 rounded-lg p-3">
          {actionError}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100 text-red-600">
              <Bell size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Alerts</p>
              <p className="text-2xl font-bold text-gray-900">{alerts.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              <Clock size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Open</p>
              <p className="text-2xl font-bold text-gray-900">
                {alerts.filter(a => a.status === 'open').length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <CheckCircle size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Acknowledged</p>
              <p className="text-2xl font-bold text-gray-900">
                {alerts.filter(a => a.status === 'acknowledged').length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <CheckCircle size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Resolved</p>
              <p className="text-2xl font-bold text-gray-900">
                {alerts.filter(a => a.status === 'resolved').length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter */}
      <Card className="p-6 mb-6">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Filter by status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </Card>

      {/* Alerts List */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <Card className="p-12 text-center">
            <Bell size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts found</h3>
            <p className="text-gray-500">You're all caught up! No alerts to show.</p>
          </Card>
        ) : (
          filteredAlerts.map((alert) => (
            <Card key={alert.id} className={`p-6 border-l-4 ${
              alert.status === 'open' ? 'border-l-red-500' : 
              alert.status === 'acknowledged' ? 'border-l-yellow-500' : 
              'border-l-green-500'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className={`p-2 rounded-full ${getAlertColor(alert.alert_type, alert.status)}`}>
                    {getAlertIcon(alert.alert_type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{alert.title}</h3>
                      <span className={`text-xs font-medium ${getPriorityColor(alert.priority)}`}>
                        Priority {alert.priority}
                      </span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        alert.status === 'open' ? 'bg-red-100 text-red-800' :
                        alert.status === 'acknowledged' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {alert.status}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-3">{alert.message}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
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
                <div className="flex items-center space-x-2">
                  {alert.status === 'open' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={processingAlertId === alert.id}
                      onClick={() => handleAcknowledge(alert.id)}
                      className="flex items-center space-x-1"
                    >
                      <CheckCircle size={16} />
                      <span>{processingAlertId === alert.id ? 'Updating...' : 'Acknowledge'}</span>
                    </Button>
                  )}
                  {alert.status === 'acknowledged' && (
                    <Button
                      size="sm"
                      disabled={processingAlertId === alert.id}
                      onClick={() => handleResolve(alert.id)}
                      className="flex items-center space-x-1"
                    >
                      <CheckCircle size={16} />
                      <span>{processingAlertId === alert.id ? 'Updating...' : 'Resolve'}</span>
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AlertsPage;
