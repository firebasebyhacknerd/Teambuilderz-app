import { useState } from 'react';
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
import API_URL from '../lib/api';

const LoginPage = () => {
  const [email, setEmail] = useState('admin@tbz.us');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(API_URL + '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        throw new Error(data.message || 'Login failed.');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('userRole', data.role);
      localStorage.setItem('userName', data.name);
      if (data.id) {
        localStorage.setItem('userId', String(data.id));
      }
      
      if (data.role === 'Admin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/recruiter';
      }

    } catch (err) {
      setLoading(false);
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(140,25%,96%)] via-[hsl(144,28%,92%)] to-[hsl(28,88%,96%)] p-4">
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
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10"
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
            </div>
            {error && (
              <div className="text-sm text-red-700 bg-red-100/80 border border-red-200 rounded-md px-3 py-2 text-center">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col text-xs text-muted-foreground space-y-1 text-center">
          <span className="font-semibold text-gray-600">Test Credentials:</span>
          <span>Admin: admin@tbz.us / admin123</span>
          <span>Recruiter: sarthi@tbz.us / recruit123</span>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginPage;
