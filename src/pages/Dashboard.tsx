import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Package, CheckCircle, Truck, AlertTriangle, IndianRupee, ChevronDown } from 'lucide-react';

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

interface DeliveryItem {
  id: string;
  invoice_number: string;
  invoice_status: string;
  delivery_date: string;
  customers: {
    name: string;
    phone: string;
  } | null;
}

const Dashboard: React.FC = () => {
  const { isAdmin, outletId, outlets, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    invoicesToday: 0, piecesInProcess: 0, piecesReady: 0,
    deliveriesToday: 0, overdueDeliveries: 0,
  });
  const [loading, setLoading] = useState(true);
  const [todaysDeliveries, setTodaysDeliveries] = useState<DeliveryItem[]>([]);

  // Dashboard range selector (UI only for now)
  type Range = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';
  const [range, setRange] = useState<Range>('today');
  const [rangeOpen, setRangeOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setRangeOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute date boundaries based on selected range
  const getDateRange = () => {
    const now = new Date();

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (range) {
      case 'today':
        return { start: startOfDay };

      case 'week': {
        const day = startOfDay.getDay();
        const diff = startOfDay.getDate() - day + (day === 0 ? -6 : 1);
        return { start: new Date(startOfDay.setDate(diff)) };
      }

      case 'month':
        return { start: new Date(now.getFullYear(), now.getMonth(), 1) };

      case 'quarter': {
        const quarter = Math.floor(now.getMonth() / 3);
        return { start: new Date(now.getFullYear(), quarter * 3, 1) };
      }

      case 'year':
        return { start: new Date(now.getFullYear(), 0, 1) };

      case 'all':
      default:
        return { start: null };
    }
  };

  useEffect(() => {
    fetchStats();
  }, [outletId, isAdmin, range]);

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { start } = getDateRange();
      const startISO = start ? start.toISOString() : null;

      // Invoices created today or in range
      let invoiceQuery = supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false);

      if (startISO) {
        invoiceQuery = invoiceQuery.gte('created_at', startISO);
      }

      if (!isAdmin && outletId) {
        invoiceQuery = invoiceQuery.eq('outlet_id', outletId);
      }

      const { count: invoicesToday } = await invoiceQuery;

      // Items in process
      let inProcessQuery = supabase
        .from('invoice_items')
        .select('quantity, invoices!inner(outlet_id)')
        .eq('status', 'In Process');

      if (!isAdmin && outletId) {
        inProcessQuery = inProcessQuery.eq('invoices.outlet_id', outletId);
      }

      const { data: inProcessItems } = await inProcessQuery;
      const piecesInProcess = inProcessItems?.reduce((sum, i) => sum + i.quantity, 0) || 0;

      // Items ready
      let readyQuery = supabase
        .from('invoice_items')
        .select('quantity, invoices!inner(outlet_id)')
        .eq('status', 'Ready');

      if (!isAdmin && outletId) {
        readyQuery = readyQuery.eq('invoices.outlet_id', outletId);
      }

      const { data: readyItems } = await readyQuery;
      const piecesReady = readyItems?.reduce((sum, i) => sum + i.quantity, 0) || 0;

      // Deliveries due today
      let deliveriesQuery = supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('delivery_date', today)
        .neq('invoice_status', 'Delivered');

      if (!isAdmin && outletId) {
        deliveriesQuery = deliveriesQuery.eq('outlet_id', outletId);
      }

      const { count: deliveriesToday } = await deliveriesQuery;

      // Fetch detailed deliveries list
      let deliveriesListQuery = supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_status,
          delivery_date,
          customers(name, phone)
        `)
        .eq('is_deleted', false)
        .eq('delivery_date', today)
        .neq('invoice_status', 'Delivered')
        .order('created_at', { ascending: true });

      if (!isAdmin && outletId) {
        deliveriesListQuery = deliveriesListQuery.eq('outlet_id', outletId);
      }

      const { data: deliveriesList } = await deliveriesListQuery;

      setTodaysDeliveries(deliveriesList || []);

      // Overdue
      let overdueQuery = supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .lt('delivery_date', today)
        .neq('invoice_status', 'Delivered');

      if (!isAdmin && outletId) {
        overdueQuery = overdueQuery.eq('outlet_id', outletId);
      }

      const { count: overdueDeliveries } = await overdueQuery;

      const newStats: DashboardStats = {
        invoicesToday: invoicesToday || 0,
        piecesInProcess,
        piecesReady,
        deliveriesToday: deliveriesToday || 0,
        overdueDeliveries: overdueDeliveries || 0,
      };

      if (isAdmin) {
        // Revenue for selected range
        let revenueQuery = supabase
          .from('invoices')
          .select('total_amount')
          .eq('is_deleted', false);

        if (startISO) {
          revenueQuery = revenueQuery.gte('created_at', startISO);
        }

        const { data: revenueInvoices } = await revenueQuery;

        newStats.revenueToday =
          revenueInvoices?.reduce((sum, i) => sum + Number(i.total_amount), 0) || 0;

        // Outstanding
        let outstandingQuery = supabase
          .from('invoice_financials')
          .select('total_due')
          .gt('total_due', 0);

        if (!isAdmin && outletId) {
          outstandingQuery = outstandingQuery.eq('outlet_id', outletId);
        }

        const { data: outstandingInvoices } = await outstandingQuery;

        newStats.outstanding =
          outstandingInvoices?.reduce((sum, i) => sum + Number(i.total_due), 0) || 0;

        // Collected for selected range
        let paymentsQuery = supabase
          .from('payments')
          .select('amount, invoices!inner(outlet_id)');

        if (startISO) {
          paymentsQuery = paymentsQuery.gte('created_at', startISO);
        }

        if (!isAdmin && outletId) {
          paymentsQuery = paymentsQuery.eq('invoices.outlet_id', outletId);
        }

        const { data: todayPayments } = await paymentsQuery;

        newStats.collectedToday =
          todayPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
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

      {/* Time Period Selector */}
      <div ref={dropdownRef} className="relative inline-block">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Time Period:</span>

          <button
            onClick={() => setRangeOpen((prev) => !prev)}
            className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted transition-colors min-w-[180px]"
          >
            <span>
              {{
                today: 'Today',
                week: 'This Week',
                month: 'This Month',
                quarter: 'This Quarter',
                year: 'This Year',
                all: 'All Time',
              }[range]}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${rangeOpen ? 'rotate-180' : ''
                }`}
            />
          </button>
        </div>

        {rangeOpen && (
          <div className="absolute left-0 top-full z-50 mt-2 w-full min-w-[180px] rounded-xl border border-border bg-background shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            {[
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: 'quarter', label: 'This Quarter' },
              { key: 'year', label: 'This Year' },
              { key: 'all', label: 'All Time' },
            ].map((r) => (
              <button
                key={r.key}
                onClick={() => {
                  setRange(r.key as Range);
                  setRangeOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                  ${range === r.key
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-foreground'}
                `}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={IndianRupee} label="Revenue" value={`₹${stats.revenueToday?.toLocaleString('en-IN') || 0}`} />
          <StatCard icon={IndianRupee} label="Collected" value={`₹${stats.collectedToday?.toLocaleString('en-IN') || 0}`} color="text-success" />
          <StatCard icon={IndianRupee} label="This Month" value={`₹${stats.revenueMonth?.toLocaleString('en-IN') || 0}`} />
          <StatCard icon={AlertTriangle} label="Outstanding" value={`₹${stats.outstanding?.toLocaleString('en-IN') || 0}`} color="text-destructive" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={FileText} label="Invoices" value={stats.invoicesToday} />
        <StatCard icon={Package} label="In Process" value={stats.piecesInProcess} />
        <StatCard icon={CheckCircle} label="Ready" value={stats.piecesReady} color="text-success" />
        <StatCard icon={Truck} label="Due Today" value={stats.deliveriesToday} />
      </div>

      {/* Today's Deliveries */}
      {todaysDeliveries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Today's Deliveries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todaysDeliveries.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-semibold">{d.invoice_number}</p>
                  <p className="text-sm text-muted-foreground">
                    {d.customers?.name || 'Customer'} • {d.customers?.phone || ''}
                  </p>
                </div>

                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full
                    ${d.invoice_status === 'Ready'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                    }`}
                >
                  {d.invoice_status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* {stats.overdueDeliveries > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">{stats.overdueDeliveries} Overdue Deliveries</p>
              <p className="text-xs text-muted-foreground">Past delivery date, not yet delivered</p>
            </div>
          </CardContent>
        </Card>
      )} */}
    </div>
  );
};

export default Dashboard;
