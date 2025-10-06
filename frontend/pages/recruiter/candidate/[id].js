import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Card from '../../../components/UI/Card';
import Button from '../../../components/UI/Button';
import { ArrowLeft, User, Briefcase, Target, TrendingUp, Edit, Save, X } from 'lucide-react';
import API_URL from '../../../lib/api';

const formatStage = (stage) => {
  if (!stage) return 'N/A';
  return stage
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getStageColor = (stage) => {
  const colors = {
    onboarding: 'bg-blue-100 text-blue-800',
    marketing: 'bg-yellow-100 text-yellow-800',
    interviewing: 'bg-purple-100 text-purple-800',
    offered: 'bg-green-100 text-green-800',
    placed: 'bg-emerald-100 text-emerald-800',
    inactive: 'bg-gray-100 text-gray-800'
  };
  return colors[stage] || 'bg-blue-100 text-blue-800';
};

const CandidateDetailPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [dailyApps, setDailyApps] = useState(0);
  const [totalApps, setTotalApps] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    if (id) {
      fetchCandidateDetails();
    }
  }, [id, router]);

  const fetchCandidateDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/v1/candidates`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.status === 401 || response.status === 403) {
        router.push('/login');
        return;
      }

      const candidates = await response.json();
      const candidateData = candidates.find(c => c.id === parseInt(id));
      
      if (candidateData) {
        setCandidate(candidateData);
        setDailyApps(candidateData.daily_applications || 0);
        setTotalApps(candidateData.total_applications || 0);
      }
    } catch (error) {
      console.error('Error fetching candidate details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/v1/candidates/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          daily_applications: dailyApps,
          total_applications: totalApps,
        }),
      });

      if (response.ok) {
        setCandidate(prev => ({
          ...prev,
          daily_applications: dailyApps,
          total_applications: totalApps,
        }));
        setEditing(false);
      }
    } catch (error) {
      console.error('Error updating candidate:', error);
    }
  };

  const handleCancel = () => {
    setDailyApps(candidate.daily_applications || 0);
    setTotalApps(candidate.total_applications || 0);
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading candidate details...</p>
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Candidate not found</p>
          <Button onClick={() => router.push('/recruiter')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const stageLabel = useMemo(() => formatStage(candidate.current_stage), [candidate.current_stage]);
  const primarySkill = useMemo(() => candidate.skills?.[0] || 'N/A', [candidate.skills]);
  return (
    <div className="min-h-screen bg-gray-50/50 backdrop-blur-sm p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/recruiter')}
              className="p-2 hover:bg-white/70 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{candidate.name}</h1>
              <p className="text-gray-600">{candidate.email}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${getStageColor(candidate.current_stage)}`}
            >
              {stageLabel}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info Card */}
          <Card className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Candidate Information</h2>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit</span>
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSave}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-semibold text-gray-800">{candidate.name}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-green-100 rounded-xl">
                    <Briefcase className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Primary Skill</p>
                    <p className="font-semibold text-gray-800">{primarySkill}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <Target className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Daily Applications</p>
                    {editing ? (
                      <input
                        type="number"
                        value={dailyApps}
                        onChange={(e) => setDailyApps(parseInt(e.target.value) || 0)}
                        className="w-20 px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="font-semibold text-gray-800">{candidate.daily_applications || 0}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-orange-100 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Applications</p>
                    {editing ? (
                      <input
                        type="number"
                        value={totalApps}
                        onChange={(e) => setTotalApps(parseInt(e.target.value) || 0)}
                        className="w-20 px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="font-semibold text-gray-800">{candidate.total_applications || 0}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Stats Card */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance Stats</h3>
            <div className="space-y-4">
              <div className="text-center p-4 bg-blue-50 rounded-xl">
                <p className="text-2xl font-bold text-blue-600">{candidate.daily_applications || 0}</p>
                <p className="text-sm text-gray-600">Today's Applications</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <p className="text-2xl font-bold text-green-600">{candidate.total_applications || 0}</p>
                <p className="text-sm text-gray-600">Total Applications</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-xl">
                <p className="text-2xl font-bold text-purple-600">
                  {candidate.total_applications > 0 ? Math.round((candidate.daily_applications / candidate.total_applications) * 100) : 0}%
                </p>
                <p className="text-sm text-gray-600">Daily vs Total</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CandidateDetailPage;
