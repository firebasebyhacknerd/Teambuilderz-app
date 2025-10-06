import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Input from '../../components/UI/Input';
import { Plus, Search, Filter, Eye, Edit, Trash2, FileText, Calendar, User } from 'lucide-react';
import { useRouter } from 'next/router';
import API_URL from '../../lib/api';

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

  const stages = ['onboarding', 'marketing', 'interviewing', 'offered', 'placed', 'inactive'];

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
        fetch(`${API_URL}/api/v1/candidates`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/v1/users`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (candidatesRes.status === 401 || candidatesRes.status === 403) {
        router.push('/login');
        return;
      }

      const candidatesData = await candidatesRes.json();
      const recruitersData = await recruitersRes.json();
      
      setCandidates(candidatesData);
      setRecruiters(recruitersData.filter(u => u.role === 'Recruiter'));
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
          'Authorization': `Bearer ${token}`,
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
        headers: { 'Authorization': `Bearer ${token}` }
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

  const filteredCandidates = candidates.filter(candidate => {
    const matchesSearch = candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         candidate.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = !stageFilter || candidate.current_stage === stageFilter;
    const matchesRecruiter = !recruiterFilter || candidate.assigned_recruiter_id === parseInt(recruiterFilter);
    
    return matchesSearch && matchesStage && matchesRecruiter;
  });

  const getStageColor = (stage) => {
    const colors = {
      onboarding: 'bg-blue-100 text-blue-800',
      marketing: 'bg-yellow-100 text-yellow-800',
      interviewing: 'bg-purple-100 text-purple-800',
      offered: 'bg-green-100 text-green-800',
      placed: 'bg-emerald-100 text-emerald-800',
      inactive: 'bg-gray-100 text-gray-800'
    };
    return colors[stage] || 'bg-gray-100 text-gray-800';
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading candidates...</div>;

  return (
    <div className="min-h-screen bg-gray-50/50 backdrop-blur-sm p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Candidate Management</h1>
        <p className="text-gray-600 mt-2">Manage all candidates and their lifecycle stages</p>
      </div>

      {error && !(showCreateModal || editingCandidate) && (
        <div className="mb-6 text-sm text-red-600 bg-red-100/80 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Filters and Search */}
      <Card className="p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <Input
                placeholder="Search candidates by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Stages</option>
            {stages.map(stage => (
              <option key={stage} value={stage}>{stage.charAt(0).toUpperCase() + stage.slice(1)}</option>
            ))}
          </select>
          <select
            value={recruiterFilter}
            onChange={(e) => setRecruiterFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Recruiters</option>
            {recruiters.map(recruiter => (
              <option key={recruiter.id} value={recruiter.id}>{recruiter.name}</option>
            ))}
          </select>
          <Button
            onClick={() => {
              setError('');
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2"
          >
            <Plus size={20} />
            Add Candidate
          </Button>
        </div>
      </Card>

      {/* Candidates Table */}
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
                <tr key={candidate.id} className="hover:bg-gray-50">
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
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStageColor(candidate.current_stage)}`}>
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
                    <div className="flex flex-wrap gap-1">
                      {candidate.skills?.slice(0, 3).map((skill, index) => (
                        <span key={index} className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                          {skill}
                        </span>
                      ))}
                      {candidate.skills?.length > 3 && (
                        <span className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                          +{candidate.skills.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => router.push(`/recruiter/candidate/${candidate.id}`)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setError('');
                          setEditingCandidate(candidate);
                        }}
                        className="text-green-600 hover:text-green-900"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteCandidate(candidate.id)}
                        className="text-red-600 hover:text-red-900"
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
            <p className="text-gray-500">Try adjusting your search or filters</p>
          </div>
        )}
      </Card>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingCandidate) && (
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
    </div>
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {candidate ? 'Edit Candidate' : 'Add New Candidate'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
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
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visa Status</label>
              <Input
                value={formData.visa_status}
                onChange={(e) => setFormData({ ...formData, visa_status: e.target.value })}
              />
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
                <option value="onboarding">Onboarding</option>
                <option value="marketing">Marketing</option>
                <option value="interviewing">Interviewing</option>
                <option value="offered">Offered</option>
                <option value="placed">Placed</option>
                <option value="inactive">Inactive</option>
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
                {recruiters.map(recruiter => (
                  <option key={recruiter.id} value={recruiter.id}>{recruiter.name}</option>
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
            <div className="text-sm text-red-600 bg-red-100/80 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : candidate ? 'Update Candidate' : 'Create Candidate'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminCandidates;
