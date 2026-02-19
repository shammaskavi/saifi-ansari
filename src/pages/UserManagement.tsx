import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';

const UserManagement: React.FC = () => {
  const { outlets } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [outletId, setOutletId] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data: roles } = await supabase.from('user_roles').select('*');
    const { data: profiles } = await supabase.from('profiles').select('*');

    if (roles && profiles) {
      const combined = roles.map((r: any) => {
        const profile = profiles.find((p: any) => p.user_id === r.user_id);
        const outlet = outlets.find(o => o.id === r.outlet_id);
        return {
          ...r,
          full_name: profile?.full_name || 'Unknown',
          outlet_name: outlet?.name || 'All',
        };
      });
      setUsers(combined);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'staff' && !outletId) {
      toast({ title: 'Select outlet for staff', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      // Sign up user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (authErr) throw authErr;
      if (!authData.user) throw new Error('User creation failed');

      // Assign role
      const { error: roleErr } = await supabase.from('user_roles').insert({
        user_id: authData.user.id,
        role,
        outlet_id: role === 'staff' ? outletId : null,
      });
      if (roleErr) throw roleErr;

      toast({ title: 'User Created', description: `${fullName} added as ${role}` });
      setOpen(false);
      setEmail(''); setPassword(''); setFullName(''); setRole('staff'); setOutletId('');
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Users</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><UserPlus className="mr-1.5 h-4 w-4" /> Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Add New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} required className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {role === 'staff' && (
                <div className="space-y-2">
                  <Label>Outlet</Label>
                  <Select value={outletId} onValueChange={setOutletId}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select outlet" /></SelectTrigger>
                    <SelectContent>
                      {outlets.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="h-11 w-full" disabled={creating}>
                {creating ? 'Creating...' : 'Create User'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {users.map(u => (
          <Card key={u.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{u.full_name}</p>
                <p className="text-xs text-muted-foreground">{u.outlet_name}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'
              }`}>
                {u.role}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default UserManagement;
