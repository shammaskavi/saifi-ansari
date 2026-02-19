import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import logoPrimary from '@/assets/logo-primary.png';

const Setup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if any admin already exists
    const checkAdmin = async () => {
      const { data } = await supabase.from('user_roles').select('id').eq('role', 'admin').limit(1);
      setHasAdmin(data && data.length > 0);
    };
    checkAdmin();
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Sign up the admin user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (authErr) throw authErr;
      if (!authData.user) throw new Error('User creation failed');

      // Wait a moment for the profile trigger to fire
      await new Promise(r => setTimeout(r, 1000));

      // Assign admin role (no outlet)
      const { error: roleErr } = await supabase.from('user_roles').insert({
        user_id: authData.user.id,
        role: 'admin',
        outlet_id: null,
      });
      if (roleErr) throw roleErr;

      toast({ title: 'Admin Created!', description: 'You are now logged in as admin.' });
      navigate('/dashboard');
    } catch (err: any) {
      toast({ title: 'Setup Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (hasAdmin === null) return null;

  if (hasAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">An admin account already exists.</p>
            <Button className="mt-4 w-full" onClick={() => navigate('/login')}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <img src={logoPrimary} alt="Banaras Dyeing" className="mb-2 h-16 w-auto" />
          <CardTitle className="font-heading text-xl">Initial Setup</CardTitle>
          <CardDescription>Create your admin account to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetup} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} required className="h-11" placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="h-11" placeholder="admin@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="h-11" placeholder="Min 6 characters" />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create Admin Account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Setup;
