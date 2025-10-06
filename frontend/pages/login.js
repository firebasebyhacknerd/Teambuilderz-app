import { useState } from 'react';
import Card from '../components/UI/Card';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import { LogIn, User, Lock } from 'lucide-react';
import API_URL from '../lib/api';

const LoginPage = () => {
  const [email, setEmail] = useState('admin@tbz.us');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen flex items-center justify-center p-4" 
         style={{ background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)' }}>
      
      <Card className="w-full max-w-md p-10">
        <div className="flex justify-center mb-6">
            <LogIn className="w-10 h-10 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 text-center mb-1">
          Staffing Architect
        </h1>
        <p className="text-gray-500 text-center mb-8">Internal Access Portal</p>
        
        <form onSubmit={handleLogin} className="space-y-6">
          
          <Input 
            label="Email Address" 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            icon={<User className="w-5 h-5 text-gray-400" />}
            required
          />
          <Input 
            label="Password" 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            icon={<Lock className="w-5 h-5 text-gray-400" />}
            required
          />

          {error && (
            <div className="text-sm text-red-700 bg-red-100/70 p-3 rounded-xl border border-red-200 text-center shadow-inner-sm">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-500">
            <p className="font-semibold">Test Credentials:</p>
            <p>Admin: admin@tbz.us / admin123</p>
            <p>Recruiter: sarthi@tbz.us / recruit123</p>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
