import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Users,
  LogOut,
  UserCheck,
  Trash2,
  Save,
  Plus,
} from 'lucide-react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import API_URL from '../../lib/api';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  useUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} from '../../lib/queryHooks';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '../../components/ui/dialog';
import { getAdminSidebarLinks } from '../../lib/adminSidebarLinks';

const AdminRecruitersPage = () => {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [userName, setUserName] = useState('Admin');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [formMessage, setFormMessage] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const createFormInitial = () => ({
    name: '',
    email: '',
    password: '',
    dailyQuota: 60,
  });

  const [formState, setFormState] = useState({
    name: '',
    email: '',
    dailyQuota: 60,
    isActive: true,
    password: '',
  });
const [createForm, setCreateForm] = useState(() => createFormInitial());
  const [filterSearch, setFilterSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedRole = localStorage.getItem('userRole');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    if (storedRole !== 'Admin') {
      router.replace('/recruiter');
      return;
    }
    setToken(storedToken);
    const storedName = localStorage.getItem('userName');
    if (storedName) {
      setUserName(storedName);
    }
  }, [router]);

  const { data: users = [], isLoading } = useUsersQuery(token, Boolean(token));

const recruiters = useMemo(
  () => users.filter((user) => user.role === 'Recruiter'),
  [users]
);

  const filteredRecruiters = useMemo(() => {
    if (!recruiters.length) {
      return [];
    }
    const term = filterSearch.trim().toLowerCase();
    return recruiters.filter((recruiter) => {
      const isActive = recruiter.is_active ?? recruiter.isActive ?? true;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && isActive) ||
        (statusFilter === 'inactive' && !isActive);
      const matchesSearch =
        !term ||
        (recruiter.name || '').toLowerCase().includes(term) ||
        (recruiter.email || '').toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [filterSearch, recruiters, statusFilter]);

  const resetFilters = useCallback(() => {
    setFilterSearch('');
    setStatusFilter('all');
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setFormState({
        name: '',
        email: '',
        dailyQuota: 60,
        isActive: true,
        password: '',
      });
      return;
    }

    const recruiter = recruiters.find((user) => user.id === selectedUserId);
    if (!recruiter) {
      setSelectedUserId(null);
      return;
    }

    setFormState({
      name: recruiter.name || '',
      email: recruiter.email || '',
      dailyQuota: recruiter.daily_quota ?? recruiter.dailyQuota ?? 60,
      isActive: recruiter.is_active ?? recruiter.isActive ?? true,
      password: '',
    });
  }, [recruiters, selectedUserId]);

  const createUser = useCreateUserMutation(token, {
    onSuccess: (data) => {
      setFormMessage({ type: 'success', text: 'Recruiter added successfully.' });
      setCreateOpen(false);
      setCreateForm(createFormInitial());
      setSelectedUserId(data?.id ?? null);
    },
    onError: (error) => {
      setFormMessage({ type: 'error', text: error.message || 'Failed to add recruiter.' });
    },
  });

  const updateUser = useUpdateUserMutation(token, {
    onSuccess: () => {
      setFormMessage({ type: 'success', text: 'Recruiter updated successfully.' });
      setFormState((prev) => ({ ...prev, password: '' }));
    },
    onError: (error) => {
      setFormMessage({ type: 'error', text: error.message || 'Failed to update recruiter.' });
    },
  });

  const deleteUser = useDeleteUserMutation(token, {
    onSuccess: () => {
      setFormMessage({ type: 'success', text: 'Recruiter removed from the team.' });
      setSelectedUserId(null);
    },
    onError: (error) => {
      setFormMessage({ type: 'error', text: error.message || 'Unable to delete recruiter.' });
    },
  });

  const handleCreateDialogToggle = (open) => {
    setCreateOpen(open);
    if (open) {
      setCreateForm(createFormInitial());
      if (formMessage) {
        setFormMessage(null);
      }
    }
  };

  const handleInputChange = (field, value) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (formMessage) {
      setFormMessage(null);
    }
  };

  const handleCreateChange = (field, value) => {
    setCreateForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (formMessage) {
      setFormMessage(null);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!selectedUserId) {
      setFormMessage({ type: 'error', text: 'Please select a recruiter to update.' });
      return;
    }

    const payload = {
      name: formState.name,
      email: formState.email,
      daily_quota: Number(formState.dailyQuota) || 0,
      is_active: Boolean(formState.isActive),
    };

    if (formState.password.trim()) {
      payload.password = formState.password;
    }

    updateUser.mutate({
      userId: selectedUserId,
      payload,
    });
  };

  const handleDelete = () => {
    if (!selectedUserId) return;
    const recruiter = recruiters.find((user) => user.id === selectedUserId);
    const confirmed = window.confirm(
      `Remove ${recruiter?.name ?? 'this recruiter'} from the team? This cannot be undone.`
    );
    if (!confirmed) return;
    deleteUser.mutate(selectedUserId);
  };

  const handleCreateSubmit = (event) => {
    event.preventDefault();
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      setFormMessage({ type: 'error', text: 'Name, email, and password are required.' });
      return;
    }

    createUser.mutate({
      name: createForm.name.trim(),
      email: createForm.email.trim(),
      password: createForm.password,
      role: 'Recruiter',
      daily_quota: Number(createForm.dailyQuota) || 0,
    });
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (logoutError) {
      console.warn('Failed to log out cleanly', logoutError);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    router.push('/login');
  };

const sidebarLinks = useMemo(() => getAdminSidebarLinks(), []);

const isMutating = updateUser.isPending || deleteUser.isPending;
const isCreateMutating = createUser.isPending;
  const hasActiveFilters = Boolean(filterSearch.trim()) || statusFilter !== 'all';
  const visibleRecruiters = filteredRecruiters;

  if (!token) {
    return null;
  }

  return (
    <Dialog open={createOpen} onOpenChange={handleCreateDialogToggle}>
      <DashboardLayout
        title="Team Management"
        subtitle={`Manage recruiter access and quotas - Signed in as ${userName}`}
        links={sidebarLinks}
        actions={
          <div className="flex items-center gap-2">
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Recruiter
              </Button>
            </DialogTrigger>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="p-6 space-y-4 xl:col-span-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Recruiter Roster
                </h3>
                <p className="text-sm text-muted-foreground">
                  Showing {visibleRecruiters.length} of {recruiters.length} recruiters
                  {hasActiveFilters ? ' (filters applied).' : '.'}
                </p>
              </div>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Recruiter
              </Button>
            </DialogTrigger>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor="recruiter-filter-search"
                className="text-xs font-semibold uppercase text-muted-foreground tracking-wide"
              >
                Search team
              </Label>
              <Input
                id="recruiter-filter-search"
                value={filterSearch}
                onChange={(event) => setFilterSearch(event.target.value)}
                placeholder="Search by name or email"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="recruiter-filter-status"
                className="text-xs font-semibold uppercase text-muted-foreground tracking-wide"
              >
                Status
              </Label>
              <select
                id="recruiter-filter-status"
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All recruiters</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>
          </div>
          {hasActiveFilters ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground">
              <span>
                Filters applied:
                {filterSearch ? ` search "${filterSearch}"` : ''}
                {filterSearch && statusFilter !== 'all' ? ' ·' : ''}
                {statusFilter !== 'all' ? ` status ${statusFilter}` : ''}
              </span>
              <Button type="button" variant="ghost" size="xs" onClick={resetFilters}>
                Clear
              </Button>
            </div>
          ) : null}
          {isLoading ? (
            <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
              Loading team data...
            </div>
            ) : recruiters.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recruiters yet. Use &quot;Add Recruiter&quot; to invite a teammate.
              </p>
            ) : visibleRecruiters.length === 0 ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>No recruiters match the current filters.</p>
                <Button type="button" variant="link" size="sm" className="px-0" onClick={resetFilters}>
                  Reset filters
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {visibleRecruiters.map((recruiter) => {
                  const isSelected = recruiter.id === selectedUserId;
                  const quota = recruiter.daily_quota ?? recruiter.dailyQuota ?? 0;
                  const statusTone = (recruiter.is_active ?? true)
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-700';

                  return (
                    <button
                      key={recruiter.id}
                      type="button"
                      onClick={() => setSelectedUserId(recruiter.id)}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary-foreground shadow-sm'
                          : 'border-border bg-card/60 hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{recruiter.name}</p>
                          <p className="text-xs text-muted-foreground">{recruiter.email}</p>
                        </div>
                        <Badge className={statusTone} variant="secondary">
                          {recruiter.is_active ?? true ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-3">
                        <span>Quota: {quota}</span>
                        {recruiter.last_login_at && (
                          <span>
                            Last login{' '}
                            {new Date(recruiter.last_login_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4 xl:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                {selectedUserId ? 'Edit Recruiter' : 'Select a recruiter to manage'}
              </h3>
              {selectedUserId && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    className="gap-2"
                    onClick={handleDelete}
                    disabled={isMutating}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
            </div>

            {formMessage && (
              <div
                className={`rounded-md border px-3 py-2 text-sm ${
                  formMessage.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {formMessage.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recruiter-name">Name</Label>
                  <Input
                    id="recruiter-name"
                    value={formState.name}
                    onChange={(event) => handleInputChange('name', event.target.value)}
                    placeholder="Recruiter name"
                    disabled={!selectedUserId || isMutating}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recruiter-email">Email</Label>
                  <Input
                    id="recruiter-email"
                    type="email"
                    value={formState.email}
                    onChange={(event) => handleInputChange('email', event.target.value)}
                    placeholder="Recruiter email"
                    disabled={!selectedUserId || isMutating}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recruiter-quota">Daily application quota</Label>
                  <Input
                    id="recruiter-quota"
                    type="number"
                    value={formState.dailyQuota}
                    onChange={(event) => handleInputChange('dailyQuota', event.target.value)}
                    placeholder="60"
                    min={0}
                    disabled={!selectedUserId || isMutating}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recruiter-password">Reset password (optional)</Label>
                  <Input
                    id="recruiter-password"
                    type="password"
                    value={formState.password}
                    onChange={(event) => handleInputChange('password', event.target.value)}
                    placeholder="Enter a new password to reset"
                    disabled={!selectedUserId || isMutating}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recruiter-status">Status</Label>
                  <select
                    id="recruiter-status"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={formState.isActive ? 'active' : 'inactive'}
                    onChange={(event) =>
                      handleInputChange('isActive', event.target.value === 'active')
                    }
                    disabled={!selectedUserId || isMutating}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" className="gap-2" disabled={!selectedUserId || isMutating}>
                  <Save className="h-4 w-4" />
                  {updateUser.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Recruiter</DialogTitle>
            <DialogDescription>
              Create a new recruiter account with initial credentials. Share the temporary password securely.
            </DialogDescription>
          </DialogHeader>
          <form id="create-recruiter-form" className="space-y-4" onSubmit={handleCreateSubmit}>
            <div className="space-y-2">
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={(event) => handleCreateChange('name', event.target.value)}
                placeholder="Recruiter name"
                required
                disabled={isCreateMutating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                onChange={(event) => handleCreateChange('email', event.target.value)}
                placeholder="Recruiter email"
                required
                disabled={isCreateMutating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Temporary password</Label>
              <Input
                id="create-password"
                type="password"
                value={createForm.password}
                onChange={(event) => handleCreateChange('password', event.target.value)}
                placeholder="Provide a temporary password"
                required
                disabled={isCreateMutating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-quota">Daily application quota</Label>
              <Input
                id="create-quota"
                type="number"
                value={createForm.dailyQuota}
                onChange={(event) => handleCreateChange('dailyQuota', event.target.value)}
                min={0}
                placeholder="60"
                required
                disabled={isCreateMutating}
              />
            </div>
          </form>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <DialogClose asChild disabled={isCreateMutating}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              form="create-recruiter-form"
              disabled={isCreateMutating}
            >
              {isCreateMutating ? 'Creating...' : 'Create Recruiter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DashboardLayout>
    </Dialog>
  );
};

export default AdminRecruitersPage;





