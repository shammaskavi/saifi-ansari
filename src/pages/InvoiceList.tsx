import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Phone, Calendar } from 'lucide-react';
import type { Invoice } from '@/lib/types';

const statusColors: Record<string, string> = {
  Open: 'bg-info/10 text-info border-info/20',
  Partial: 'bg-warning/10 text-warning border-warning/20',
  Delivered: 'bg-success/10 text-success border-success/20',
  Unpaid: 'bg-destructive/10 text-destructive border-destructive/20',
  'Partially Paid': 'bg-warning/10 text-warning border-warning/20',
  Paid: 'bg-success/10 text-success border-success/20',
};

const InvoiceList: React.FC = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        customers(name, phone)
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data) {
      setLoading(false);
      return;
    }

    // Fetch financial summaries
    const invoiceIds = data.map((i: any) => i.id);

    const { data: financials } = await (supabase as any)
      .from('invoice_financials')
      .select('id, total_paid, total_due')
      .in('id', invoiceIds);

    const financialMap = new Map(
      (financials || []).map((f: any) => [f.id, f])
    );

    const mapped = data.map((inv: any) => {
      const fin = financialMap.get(inv.id);

      let payment_status = 'Unpaid';

      if ((fin?.total_due ?? inv.total_amount) <= 0) {
        payment_status = 'Paid';
      } else if ((fin?.total_paid ?? 0) > 0) {
        payment_status = 'Partially Paid';
      }

      return {
        ...inv,
        customer_name: inv.customers?.name,
        customer_phone: inv.customers?.phone,
        payment_status,
      };
    });

    setInvoices(mapped as Invoice[]);
    setLoading(false);
  };

  const filtered = invoices.filter(inv =>
    inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    inv.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    inv.customer_phone?.includes(search)
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Invoices</h1>
        <button
          onClick={() => navigate('/invoices/new')}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or invoice #"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 pl-10"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <FileEmpty />
          <p className="mt-2">No invoices found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv) => (
            <button
              key={inv.id}
              onClick={() => navigate(`/invoices/${inv.id}`)}
              className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-secondary/50 active:bg-secondary"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-heading text-base font-bold text-foreground">
                    {inv.invoice_number}
                  </span>
                  {inv.order_type === 'Urgent' && (
                    <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-semibold text-destructive">
                      URGENT
                    </span>
                  )}
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[inv.invoice_status]}`}>
                  {inv.invoice_status}
                </span>
              </div>

              <p className="mt-1 font-medium text-foreground">{inv.customer_name}</p>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                {inv.customer_phone}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(inv.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}

              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Delivery: {new Date(inv.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                <span>{inv.total_pieces} pcs</span>
                {isAdmin && (
                  <span className="font-semibold text-foreground">₹{Number(inv.total_amount).toLocaleString('en-IN')}</span>
                )}
              </div>

              {isAdmin && (
                <div className="mt-1 flex justify-end">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[inv.payment_status]}`}>
                    {inv.payment_status}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const FileEmpty = () => (
  <svg className="mx-auto h-12 w-12 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

export default InvoiceList;
