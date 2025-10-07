import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  User,
  Users,
  Home,
  FileText,
  AlertTriangle
} from 'lucide-react';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Input from '../../components/UI/Input';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import API_URL from '../../lib/api';

const stageBadges = {
  onboarding: 'bg-blue-100 text-blue-800',
  marketing: 'bg-yellow-100 text-yellow-800',
  interviewing: 'bg-purple-100 text-purple-800',
  offered: 'bg-green-100 text-green-800',
  placed: 'bg-emerald-100 text-emerald-800',
  inactive: 'bg-gray-100 text-gray-800'
};

const stages = Object.keys(stageBadges);

const AdminCandidates = () => {
  const router = useRouter();
  const [candidates, setCandidates] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [recruiterFilter, setRecruiterFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const sidebarLinks = [
    { href: '/admin', label: 'Dashboard', icon: Home },
    { href: '/admin/candidates', label: 'Candidates', icon: Users },
    { href: '/recruiter/applications', label: 'Applications', icon: FileText },
    { href: '/alerts', label: 'Alerts', icon: AlertTriangle }
  ];

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [candidatesRes, recruitersRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/candidates`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/v1/users`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (candidatesRes.status === 401 || candidatesRes.status === 403) {
        router.push('/login');
        return;
      }

      const candidatesData = await candidatesRes.json();
      const recruitersData = await recruitersRes.json();

      setCandidates(candidatesData);
      setRecruiters(recruitersData.filter((u) => u.role === 'Recruiter'));
    } catch (fetchError) {
      console.error('Error fetching data:', fetchError);
      setError('Unable to load candidate data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCandidates = useMemo(() => {
    return candidates
      .filter((candidate) => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return true;
        return (
          candidate.name?.toLowerCase().includes(term) ||
          candidate.email?.toLowerCase().includes(term) ||
          candidate.recruiter_name?.toLowerCase().includes(term)
        );
      })
      .filter((candidate) => (stageFilter ? candidate.current_stage === stageFilter : true))
      .filter((candidate) => (recruiterFilter ? String(candidate.assigned_recruiter_id) === recruiterFilter : true));
  }, [candidates, searchTerm, stageFilter, recruiterFilter]);

  const handleCandidateSave = async (formData) => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const payload = {
        ...formData,
        experience_years: formData.experience_years ? Number(formData.experience_years) : null,
        assigned_recruiter_id: formData.assigned_recruiter_id ? Number(formData.assigned_recruiter_id) : null,
        skills: formData.skills || []
      };

      const isEditing = Boolean(editingCandidate);
      const endpoint = isEditing ? `/api/v1/candidates/${editingCandidate.id}` : '/api/v1/candidates';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to save candidate.');
      }

      await fetchData();
      setShowCreateModal(false);
      setEditingCandidate(null);
    } catch (saveError) {
      console.error('Error saving candidate:', saveError);
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCandidate = async (candidateId) => {
    const confirmed = window.confirm('Are you sure you want to delete this candidate? This action cannot be undone.');
    if (!confirmed) return;

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      setError('');
      const response = await fetch(`${API_URL}/api/v1/candidates/${candidateId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to delete candidate.');
      }

      await fetchData();
    } catch (deleteError) {
      console.error('Error deleting candidate:', deleteError);
      setError(deleteError.message);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStageFilter('');
    setRecruiterFilter('');
  };

  if (loading) {
    return (
      <DashboardLayout
        title="Candidate Management"
        subtitle="Add, edit, and assign candidates to recruiters"
        links={sidebarLinks}
        onBack={() => router.push('/admin')}
      >
        <div className="h-48 flex items-center justify-center text-gray-500">Loading candidates…</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Candidate Management"
      subtitle="Add, edit, and assign candidates to recruiters"
      links={sidebarLinks}
      onBack={() => router.push('/admin')}
      actions={
        <button
          type="button"
          onClick={() => {
            setError('');
            setEditingCandidate(null);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          <Plus size={18} />
          Add Candidate
        </button>
      }
    >
      {error && !(showCreateModal || editingCandidate) && (
        <div className="mb-6 text-sm text-red-600 bg-red-100/80 border border-red-200 rounded-lg p-3">{error}</div>
      )}

      <Card className="p-6 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Search candidates by name, email, or recruiter..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Stage</label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Stages</option>
              {stages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage.charAt(0).toUpperCase() + stage.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Recruiter</label>
            <select
              value={recruiterFilter}
              onChange={(e) => setRecruiterFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Recruiters</option>
              {recruiters.map((recruiter) => (
                <option key={recruiter.id} value={recruiter.id}>
                  {recruiter.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={resetFilters}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
            >
              Reset Filters
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {stages.map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => setStageFilter(stageFilter === stage ? '' : stage)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                stageFilter === stage
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              {stage}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recruiter</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applications</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skills</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCandidates.map((candidate) => (
                <tr
                  key={candidate.id}
                  className="hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => router.push(`/recruiter/candidate/${candidate.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User size={20} className="text-blue-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{candidate.name}</div>
                        <div className="text-sm text-gray-500">{candidate.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${stageBadges[candidate.current_stage] || stageBadges.onboarding}`}>
                      {candidate.current_stage}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {candidate.recruiter_name || 'Unassigned'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex flex-col">
                      <span className="font-medium">{candidate.total_applications || 0} total</span>
                      <span className="text-gray-500">{candidate.daily_applications || 0} today</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex flex-wrap gap-2">
                      {(candidate.skills || []).slice(0, 3).map((skill, index) => (
                        <span key={index} className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                          {skill}
                        </span>
                      ))}
                      {candidate.skills && candidate.skills.length > 3 && (
                        <span className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                          +{candidate.skills.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        className="text-blue-600 hover:text-blue-900"
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(`/recruiter/candidate/${candidate.id}`);
                        }}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="text-green-600 hover:text-green-900"
                        onClick={(event) => {
                          event.stopPropagation();
                          setError('');
                          setEditingCandidate(candidate);
                          setShowCreateModal(true);
                        }}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-900"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteCandidate(candidate.id);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredCandidates.length === 0 && (
          <div className="text-center py-12">
            <User size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No candidates found</h3>
            <p className="text-gray-500">Try adjusting your search or filters.</p>
          </div>
        )}
      </Card>

      {showCreateModal && (
        <CandidateModal
          candidate={editingCandidate}
          recruiters={recruiters}
          error={error}
          isSaving={saving}
          onClose={() => {
            setShowCreateModal(false);
            setEditingCandidate(null);
            setError('');
          }}
          onSave={handleCandidateSave}
        />
      )}
    </DashboardLayout>
  );
};

const CandidateModal = ({ candidate, recruiters, onClose, onSave, isSaving, error }) => {
  const [formData, setFormData] = useState({
    name: candidate?.name || '',
    email: candidate?.email || '',
    phone: candidate?.phone || '',
    visa_status: candidate?.visa_status || '',
    skills: candidate?.skills || [],
    experience_years: candidate?.experience_years || '',
    current_stage: candidate?.current_stage || 'onboarding',
    assigned_recruiter_id: candidate?.assigned_recruiter_id ? String(candidate.assigned_recruiter_id) : ''
  });

  useEffect(() => {
    setFormData({
      name: candidate?.name || '',
      email: candidate?.email || '',
      phone: candidate?.phone || '',
      visa_status: candidate?.visa_status || '',
      skills: candidate?.skills || [],
      experience_years: candidate?.experience_years || '',
      current_stage: candidate?.current_stage || 'onboarding',
      assigned_recruiter_id: candidate?.assigned_recruiter_id ? String(candidate.assigned_recruiter_id) : ''
    });
  }, [candidate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {candidate ? 'Edit Candidate' : 'Add New Candidate'}
          </h2>
          <button className="text-gray-500 hover:text-gray-700" onClick={onClose}>
            Close
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visa Status</label>
              <Input value={formData.visa_status} onChange={(e) => setFormData({ ...formData, visa_status: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Experience (Years)</label>
              <Input
                type="number"
                value={formData.experience_years}
                onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Stage</label>
              <select
                value={formData.current_stage}
                onChange={(e) => setFormData({ ...formData, current_stage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Recruiter</label>
              <select
                value={formData.assigned_recruiter_id}
                onChange={(e) => setFormData({ ...formData, assigned_recruiter_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Recruiter</option>
                {recruiters.map((recruiter) => (
                  <option key={recruiter.id} value={recruiter.id}>
                    {recruiter.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma-separated)</label>
            <Input
              placeholder="React, Node.js, Python..."
              value={formData.skills.join(', ')}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  skills: e.target.value
                    .split(',')
                    .map((skill) => skill.trim())
                    .filter((skill) => skill.length > 0)
                })
              }
            />
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-100/80 border border-red-200 rounded-lg p-3">{error}</div>
          )}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : candidate ? 'Update Candidate' : 'Create Candidate'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminCandidates;
