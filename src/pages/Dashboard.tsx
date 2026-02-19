import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Package, CheckCircle, Truck, AlertTriangle, IndianRupee } from 'lucide-react';

interface DashboardStats {
  invoicesToday: number;
  piecesInProcess: number;
  piecesReady: number;
  deliveriesToday: number;
  overdueDeliveries: number;
  revenueToday?: number;
  revenueMonth?: number;
  outstanding?: number;
  collectedToday?: number;
}

const Dashboard: React.FC = () => {
  const { isAdmin, outletId, outlets, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    invoicesToday: 0, piecesInProcess: 0, piecesReady: 0,
    deliveriesToday: 0, overdueDeliveries: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [outletId, isAdmin]);

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      // Invoices created today
      let invoiceQuery = supabase.from('invoices').select('*', { count: 'exact', head: true })
        .eq('is_deleted', false).gte('created_at', today + 'T00:00:00');
      if (!isAdmin && outletId) invoiceQuery = invoiceQuery.eq('outlet_id', outletId);
      const { count: invoicesToday } = await invoiceQuery;

      // Items in process
      let itemsQuery = supabase.from('invoice_items').select('quantity');
      const { data: inProcessItems } = await supabase
        .from('invoice_items')
        .select('quantity, invoice_id')
        .eq('status', 'In Process');
      const piecesInProcess = inProcessItems?.reduce((sum, i) => sum + i.quantity, 0) || 0;

      // Items ready
      const { data: readyItems } = await supabase
        .from('invoice_items')
        .select('quantity')
        .eq('status', 'Ready');
      const piecesReady = readyItems?.reduce((sum, i) => sum + i.quantity, 0) || 0;

      // Deliveries due today
      const { count: deliveriesToday } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('delivery_date', today)
        .neq('invoice_status', 'Delivered');

      // Overdue
      const { count: overdueDeliveries } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .lt('delivery_date', today)
        .neq('invoice_status', 'Delivered');

      const newStats: DashboardStats = {
        invoicesToday: invoicesToday || 0,
        piecesInProcess,
        piecesReady,
        deliveriesToday: deliveriesToday || 0,
        overdueDeliveries: overdueDeliveries || 0,
      };

      if (isAdmin) {
        // Revenue today
        const { data: todayInvoices } = await supabase
          .from('invoices')
          .select('total_amount')
          .eq('is_deleted', false)
          .gte('created_at', today + 'T00:00:00');
        newStats.revenueToday = todayInvoices?.reduce((sum, i) => sum + Number(i.total_amount), 0) || 0;

        // Revenue this month
        const { data: monthInvoices } = await supabase
          .from('invoices')
          .select('total_amount')
          .eq('is_deleted', false)
          .gte('date', monthStart);
        newStats.revenueMonth = monthInvoices?.reduce((sum, i) => sum + Number(i.total_amount), 0) || 0;

        // Outstanding
        const { data: outstandingInvoices } = await supabase
          .from('invoices')
          .select('balance_amount')
          .eq('is_deleted', false)
          .gt('balance_amount', 0);
        newStats.outstanding = outstandingInvoices?.reduce((sum, i) => sum + Number(i.balance_amount), 0) || 0;

        // Collected today
        const { data: todayPayments } = await supabase
          .from('payments')
          .select('amount')
          .gte('created_at', today + 'T00:00:00');
        newStats.collectedToday = todayPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      }

      setStats(newStats);
    } catch (e) {
      console.error('Dashboard error:', e);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value, color = 'text-primary' }: {
    icon: any; label: string; value: string | number; color?: string;
  }) => (
    <Card className="animate-fade-in">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`rounded-lg bg-secondary p-2.5 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Hello, {profile?.full_name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? 'Admin Dashboard' : 'Staff Dashboard'} — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
        </p>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={IndianRupee} label="Revenue Today" value={`₹${stats.revenueToday?.toLocaleString('en-IN') || 0}`} />
          <StatCard icon={IndianRupee} label="Collected Today" value={`₹${stats.collectedToday?.toLocaleString('en-IN') || 0}`} color="text-success" />
          <StatCard icon={IndianRupee} label="This Month" value={`₹${stats.revenueMonth?.toLocaleString('en-IN') || 0}`} />
          <StatCard icon={AlertTriangle} label="Outstanding" value={`₹${stats.outstanding?.toLocaleString('en-IN') || 0}`} color="text-destructive" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={FileText} label="Invoices Today" value={stats.invoicesToday} />
        <StatCard icon={Package} label="In Process" value={stats.piecesInProcess} />
        <StatCard icon={CheckCircle} label="Ready" value={stats.piecesReady} color="text-success" />
        <StatCard icon={Truck} label="Due Today" value={stats.deliveriesToday} />
      </div>

      {stats.overdueDeliveries > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">{stats.overdueDeliveries} Overdue Deliveries</p>
              <p className="text-xs text-muted-foreground">Past delivery date, not yet delivered</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
