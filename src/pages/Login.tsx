import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import logoPrimary from '@/assets/logo-primary.png';

const Login: React.FC = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
    } catch {
      // toast handled in context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-10 flex justify-center">
          <img src={logoPrimary} alt="Banaras Dyeing" className="h-16" />
        </div>

        <h1 className="mb-2 text-center font-heading text-2xl font-bold text-foreground">
          Welcome Back
        </h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Sign in to manage your orders
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="h-12"
            />
          </div>

          <Button type="submit" className="h-12 w-full text-base" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Banaras Dyeing since 1964
        </p>
      </div>
    </div>
  );
};

export default Login;
