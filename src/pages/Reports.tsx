import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

const Reports: React.FC = () => {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [collections, setCollections] = useState<any[]>([]);
  const [serviceRevenue, setServiceRevenue] = useState<any[]>([]);

  useEffect(() => {
    fetchReports();
  }, [dateFrom, dateTo]);

  const fetchReports = async () => {
    // Daily collections
    const { data: payments } = await supabase
      .from('payments')
      .select('amount, payment_mode, payment_date')
      .gte('payment_date', dateFrom)
      .lte('payment_date', dateTo)
      .order('payment_date', { ascending: false });

    if (payments) {
      const grouped: Record<string, { cash: number; upi: number; bank: number; total: number }> = {};
      payments.forEach((p: any) => {
        const d = p.payment_date;
        if (!grouped[d]) grouped[d] = { cash: 0, upi: 0, bank: 0, total: 0 };
        const amt = Number(p.amount);
        grouped[d].total += amt;
        if (p.payment_mode === 'Cash') grouped[d].cash += amt;
        if (p.payment_mode === 'UPI') grouped[d].upi += amt;
        if (p.payment_mode === 'Bank') grouped[d].bank += amt;
      });
      setCollections(Object.entries(grouped).map(([date, data]) => ({ date, ...data })));
    }

    // Service-wise revenue
    const { data: items } = await supabase
      .from('invoice_items')
      .select('service, total, created_at')
      .gte('created_at', dateFrom + 'T00:00:00')
      .lte('created_at', dateTo + 'T23:59:59');

    if (items) {
      const grouped: Record<string, number> = {};
      items.forEach((i: any) => {
        grouped[i.service] = (grouped[i.service] || 0) + Number(i.total);
      });
      setServiceRevenue(Object.entries(grouped).map(([service, total]) => ({ service, total })).sort((a, b) => b.total - a.total));
    }
  };

  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => row[h]).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-4">
      <h1 className="font-heading text-2xl font-bold">Reports</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-10" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-10" />
        </div>
      </div>

      {/* Daily Collections */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Daily Collections</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => exportCSV(collections, 'collections.csv')}>
            <Download className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {collections.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No data for this period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-3 text-left text-xs text-muted-foreground">Date</th>
                    <th className="p-3 text-right text-xs text-muted-foreground">Cash</th>
                    <th className="p-3 text-right text-xs text-muted-foreground">UPI</th>
                    <th className="p-3 text-right text-xs text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.map(c => (
                    <tr key={c.date} className="border-b border-border/50">
                      <td className="p-3">{new Date(c.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                      <td className="p-3 text-right">₹{c.cash.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right">₹{c.upi.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-semibold">₹{c.total.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Revenue */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Service Revenue</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => exportCSV(serviceRevenue, 'service-revenue.csv')}>
            <Download className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {serviceRevenue.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No data for this period</p>
          ) : (
            <div className="space-y-2 p-4">
              {serviceRevenue.map(s => (
                <div key={s.service} className="flex items-center justify-between">
                  <span className="text-sm">{s.service}</span>
                  <span className="font-semibold">₹{s.total.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
