import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useCallback } from 'react';
import { AlertTriangle, CircleUser, FileText, Home, Target, TrendingUp, Users } from 'lucide-react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { track } from '../../lib/analytics';
import API_URL from '../../lib/api';
import { emitRefresh, useRefreshListener, REFRESH_CHANNELS } from '../../lib/refreshBus';

const initialFormState = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function ProfilePage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(initialFormState);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const storedToken = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    const storedRole = typeof window !== 'undefined' ? window.localStorage.getItem('userRole') : null;

    if (!storedToken) {
      router.push('/login');
      return;
    }

    setToken(storedToken);
    setUserRole(storedRole ?? 'Recruiter');
  }, [router]);

  const fetchProfile = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${API_URL}/api/v1/profile`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Unable to load profile information.');
      }

      const data = await response.json();
      setProfile(data);
      setForm((prev) => ({
        ...prev,
        name: data.name ?? '',
        email: data.email ?? '',
      }));
      track('profile_view', { role: data.role });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [router, token]);

  useEffect(() => {
    if (!token) return;
    fetchProfile();
  }, [fetchProfile, token]);

  useRefreshListener(REFRESH_CHANNELS.PROFILE, fetchProfile);

  const sidebarLinks = useMemo(() => {
    if (userRole === 'Admin') {
      return [
        { href: '/admin', label: 'Dashboard', icon: Home },
        { href: '/admin/candidates', label: 'Candidates', icon: Users },
        { href: '/admin/recruiters', label: 'Team Management', icon: CircleUser },
        { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
        { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
        { href: '/profile', label: 'My Profile', icon: CircleUser },
      ];
    }

    return [
      { href: '/recruiter', label: 'Dashboard', icon: Target },
      { href: '/recruiter/candidates', label: 'Candidates', icon: Users },
      { href: '/recruiter/applications', label: 'Applications', icon: FileText },
      { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
      { href: '/profile', label: 'My Profile', icon: CircleUser },
    ];
  }, [userRole]);

  const handleChange = (field) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token) return;

    if (form.password && form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const payload = {
        name: form.name,
        email: form.email,
      };

      if (form.password) {
        payload.password = form.password;
      }

      const response = await fetch(`${API_URL}/api/v1/profile`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Unable to update profile.');
      }

      const updated = await response.json();
      setProfile(updated);
      setForm((prev) => ({
        ...prev,
        password: '',
        confirmPassword: '',
      }));
      track('profile_update_success', { emailChanged: profile?.email !== updated.email });
      setSuccess('Profile updated successfully.');
      emitRefresh(REFRESH_CHANNELS.PROFILE);
      emitRefresh(REFRESH_CHANNELS.DASHBOARD);
    } catch (err) {
      setError(err.message);
      track('profile_update_error', { message: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!token || loading) {
    return (
      <DashboardLayout title="My Profile" subtitle="Loading your details..." links={sidebarLinks}>
        <div className="h-48 flex items-center justify-center text-muted-foreground">Loading profile…</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="My Profile"
      subtitle="Keep your access details up to date"
      links={sidebarLinks}
      actions={null}
    >
      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="font-display text-2xl">Account details</CardTitle>
            <p className="text-sm text-muted-foreground">
              Update your name, email, and password. Password changes are optional.
            </p>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={handleChange('name')}
                    placeholder="Your name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange('email')}
                    placeholder="you@company.com"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange('password')}
                    placeholder="••••••••"
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={handleChange('confirmPassword')}
                    placeholder="••••••••"
                    minLength={8}
                  />
                </div>
              </div>
              {profile?.role && (
                <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
                  <span>
                    Signed in as <span className="font-semibold text-foreground">{profile.role}</span>
                  </span>
                  <span>Member since {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}</span>
                </div>
              )}
              {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {success}
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-between">
              <div className="text-xs text-muted-foreground">
                Password updates are optional. Leave the fields blank to keep your current password.
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving changes…' : 'Save changes'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}


