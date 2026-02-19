import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import type { Invoice } from '@/lib/types';

const AddPayment: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'Cash' | 'UPI' | 'Bank'>('Cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from('invoices').select('*').eq('id', id!).single().then(({ data }) => {
      if (data) setInvoice(data as unknown as Invoice);
    });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }
    if (invoice && amt > Number(invoice.balance_amount)) {
      toast({ title: 'Amount exceeds balance', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('payments').insert({
        invoice_id: id!,
        amount: amt,
        payment_mode: mode,
        notes: notes.trim() || null,
      });
      if (error) throw error;

      // Update invoice amounts
      const newPaid = Number(invoice!.amount_paid) + amt;
      const newBalance = Number(invoice!.total_amount) - newPaid;
      const paymentStatus = newBalance <= 0 ? 'Paid' : newPaid > 0 ? 'Partially Paid' : 'Unpaid';

      await supabase.from('invoices').update({
        amount_paid: newPaid,
        payment_status: paymentStatus,
      }).eq('id', id!);

      toast({ title: 'Payment Added', description: `₹${amt.toLocaleString('en-IN')} recorded` });
      navigate(`/invoices/${id}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!invoice) return null;

  return (
    <div className="p-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-heading text-xl font-bold">Add Payment</h1>
      </div>

      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Invoice {invoice.invoice_number}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Total:</span>
            <span className="ml-1 font-semibold">₹{Number(invoice.total_amount).toLocaleString('en-IN')}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Balance:</span>
            <span className="ml-1 font-semibold text-destructive">₹{Number(invoice.balance_amount).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label>Amount (₹) *</Label>
          <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="h-12 text-lg" placeholder="0" required min="1" step="0.01" />
        </div>

        <div className="space-y-2">
          <Label>Payment Mode</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as any)}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="UPI">UPI</SelectItem>
              <SelectItem value="Bank">Bank Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
        </div>

        <Button type="submit" className="h-12 w-full text-base" disabled={submitting}>
          {submitting ? 'Recording...' : 'Record Payment'}
        </Button>
      </form>
    </div>
  );
};

export default AddPayment;
