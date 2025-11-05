import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { LogIn, User, Lock, Eye, EyeOff } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ThemeSelect } from '../components/ui/theme-toggle';
import API_URL from '../lib/api';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownTimerRef = useRef(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const nextErrors = {
      email: trimmedEmail ? '' : 'Email is required.',
      password: trimmedPassword ? '' : 'Password is required.',
    };

    if (trimmedEmail && !emailPattern.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    setFieldErrors(nextErrors);

    if (nextErrors.email || nextErrors.password) {
      return;
    }

    if (trimmedEmail !== email) {
      setEmail(trimmedEmail);
    }

    setLoading(true);

    try {
      const response = await fetch(API_URL + '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed.');
      }

      localStorage.setItem('token', 'session');
      localStorage.setItem('userRole', data.role);
      localStorage.setItem('userName', data.name);
      if (data.id) {
        localStorage.setItem('userId', String(data.id));
      }

      setFieldErrors({ email: '', password: '' });
      setCapsLockOn(false);
      setCooldownSeconds(0);
      window.location.href = data.role === 'Admin' ? '/admin' : '/recruiter';
    } catch (err) {
      setError(err.message);
      setFieldErrors((prev) => ({
        ...prev,
        password: prev.password || 'Check your email and password, then try again.',
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailBlur = () => {
    const trimmedEmail = email.trim();
    setFieldErrors((prev) => ({
      ...prev,
      email: trimmedEmail
        ? emailPattern.test(trimmedEmail)
          ? ''
          : 'Enter a valid email address.'
        : 'Email is required.',
    }));
  };

  const handlePasswordBlur = () => {
    const trimmedPassword = password.trim();
    setFieldErrors((prev) => ({
      ...prev,
      password: trimmedPassword ? '' : 'Password is required.',
    }));
  };

  const handlePasswordKeyUp = (event) => {
    if (typeof event.getModifierState === 'function') {
      setCapsLockOn(event.getModifierState('CapsLock'));
    }
  };


  useEffect(() => {
    if (cooldownSeconds <= 0) {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      return;
    }

    if (cooldownTimerRef.current) {
      return;
    }

    cooldownTimerRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimerRef.current);
          cooldownTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, [cooldownSeconds]);

  const cooldownLabel = useMemo(() => {
    const minutes = Math.floor(cooldownSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (cooldownSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [cooldownSeconds]);

  const passwordHelpIds = [fieldErrors.password ? 'password-error' : null, capsLockOn ? 'password-capslock' : null]
    .filter(Boolean)
    .join(' ');


  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--surface))] to-[hsl(var(--background))] p-4">
      <div className="absolute right-4 top-4">
        <ThemeSelect hideLabel compact />
      </div>
      <Card className="w-full max-w-md shadow-lg backdrop-blur-sm border border-border/70">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-xl bg-secondary/70 flex items-center justify-center ring-2 ring-primary/15">
            <Image src="/logo.svg" alt="TeamBuilderz" width={48} height={48} priority />
          </div>
          <CardTitle className="text-3xl font-semibold text-foreground">TeamBuilderz Portal</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Sign in to orchestrate candidates, applications, and interviews with confidence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="space-y-1">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: '' }));
                      }
                    }}
                    onBlur={handleEmailBlur}
                    placeholder="you@company.com"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                    className={`pl-9 ${fieldErrors.email ? 'border-red-500 focus-visible:ring-red-500 focus-visible:ring-offset-0' : ''}`}
                    required
                  />
                </div>
                {fieldErrors.email && (
                  <p id="email-error" className="text-xs text-red-600" role="alert" aria-live="polite">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="space-y-1">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: '' }));
                      }
                    }}
                    onBlur={handlePasswordBlur}
                    onKeyUp={handlePasswordKeyUp}
                    placeholder="Enter your password"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={passwordHelpIds || undefined}
                    className={`pl-9 pr-10 ${
                      fieldErrors.password ? 'border-red-500 focus-visible:ring-red-500 focus-visible:ring-offset-0' : ''
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="password-error" className="text-xs text-red-600" role="alert" aria-live="polite">
                    {fieldErrors.password}
                  </p>
                )}
                {capsLockOn && !fieldErrors.password && (
                  <p id="password-capslock" className="text-xs text-amber-600">
                    Caps Lock is on. Passwords are case sensitive.
                  </p>
                )}
              </div>
            </div>
            {error && (
              <div
                className="text-sm text-red-700 bg-red-100/80 border border-red-200 rounded-md px-3 py-2 text-center"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={
                loading || Boolean(fieldErrors.email) || Boolean(fieldErrors.password) || cooldownSeconds > 0
              }
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </Button>
            {cooldownSeconds > 0 && (
              <p className="text-xs text-amber-700 bg-amber-100/70 border border-amber-200 rounded-md px-3 py-2 text-center" role="status" aria-live="polite">
                Too many attempts. Try again in {cooldownLabel}.
              </p>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-center text-xs text-muted-foreground">
          <p>Forgot your credentials? Reach out to your TeamBuilderz administrator for access.</p>
          <p className="text-muted-foreground/80">
            For security, shared testing logins are no longer displayed here.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginPage;






