import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ShieldCheck, Mail, Lock, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import API_URL from '../lib/api';

const LoginPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const token = window.localStorage.getItem('token');
    const role = window.localStorage.getItem('userRole');
    if (token && role) {
      router.replace(role === 'Admin' ? '/admin' : '/recruiter');
    }
  }, [router]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      setErrorMessage('Email and password are required.');
      return;
    }
    setSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.message || 'Unable to log in. Please verify your credentials.';
        throw new Error(message);
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('token', 'session');
        window.localStorage.setItem('userRole', payload?.role || '');
        window.localStorage.setItem('userName', payload?.name || '');
        if (payload?.id) {
          window.localStorage.setItem('userId', String(payload.id));
        }
      }

      router.replace(payload?.role === 'Admin' ? '/admin' : '/recruiter');
    } catch (loginError) {
      const message =
        loginError instanceof Error ? loginError.message : 'Unexpected error during login. Please try again.';
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-8 shadow-xl space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">TeamBuilderz Access</h1>
            <p className="text-sm text-muted-foreground">Sign in to monitor candidates and track recruiter activity.</p>
          </div>
        </div>

        {errorMessage ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="login-email">Work Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="login-email"
                type="email"
                placeholder="you@teambuilderz.us"
                autoComplete="email"
                className="pl-10"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                className="pl-10"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Protected access. Reach out to your TeamBuilderz administrator if you need help signing in.
        </p>
      </Card>
    </div>
  );
};

export default LoginPage;
