import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, MessageCircle, Phone, MapPin, Calendar, Package, Printer, Save } from 'lucide-react';
import type { Invoice, InvoiceItem, Payment } from '@/lib/types';
import PrintInvoice from '@/components/PrintInvoice';

const statusOrder = ['Received', 'In Process', 'Ready', 'Delivered'] as const;

const statusBadgeClass: Record<string, string> = {
  Received: 'bg-muted text-muted-foreground',
  'In Process': 'bg-info/10 text-info',
  Ready: 'bg-success/10 text-success',
  Delivered: 'bg-primary/10 text-primary',
};

interface Outlet {
  name: string;
  address: string | null;
  phone: string | null;
}

const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [loading, setLoading] = useState(true);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesEdited, setNotesEdited] = useState(false);

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    const [invRes, itemsRes, paymentsRes] = await Promise.all([
      supabase
        .from('invoices')
        .select(`
          *,
          customers(name, phone, address)
        `)
        .eq('id', id!)
        .single(),
      supabase.from('invoice_items').select('*').eq('invoice_id', id!),
      isAdmin ? supabase.from('payments').select('*').eq('invoice_id', id!).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
    ]);

    let financials: any = null;

    const { data: finData } = await supabase
      .from('invoice_financials')
      .select('total_paid, total_due')
      .eq('id', id!)
      .single();

    financials = finData;

    if (invRes.data) {
      const invData = invRes.data as any;

      const mergedInvoice: any = {
        ...invData,
        customer_name: invData.customers?.name,
        customer_phone: invData.customers?.phone,
        customer_address: invData.customers?.address,
        amount_paid: financials?.total_paid ?? 0,
        balance_amount: financials?.total_due ?? 0,
      };

      setInvoice(mergedInvoice as Invoice);
      setDeliveryNotes(invData.delivery_notes || '');

      // Fetch outlet info for print
      const { data: outletData } = await supabase.from('outlets').select('name, address, phone').eq('id', invData.outlet_id).single();
      if (outletData) setOutlet(outletData as Outlet);
    }
    if (itemsRes.data) setItems(itemsRes.data as unknown as InvoiceItem[]);
    if (paymentsRes.data) setPayments(paymentsRes.data as unknown as Payment[]);
    setLoading(false);
  };

  const updateItemStatus = async (itemId: string, newStatus: string) => {
    const { error } = await supabase
      .from('invoice_items')
      .update({ status: newStatus })
      .eq('id', itemId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setItems(items.map(i => i.id === itemId ? { ...i, status: newStatus as any } : i));
      toast({ title: 'Updated', description: `Item status changed to ${newStatus}` });

      const updatedItems = items.map(i => i.id === itemId ? { ...i, status: newStatus } : i);
      const allDelivered = updatedItems.every(i => i.status === 'Delivered');
      const someDelivered = updatedItems.some(i => i.status === 'Delivered');
      const invoiceStatus = allDelivered ? 'Delivered' : someDelivered ? 'Partial' : 'Open';

      await supabase.from('invoices').update({ invoice_status: invoiceStatus }).eq('id', id!);
      setInvoice(prev => prev ? { ...prev, invoice_status: invoiceStatus as any } : null);
    }
  };

  const saveDeliveryNotes = async () => {
    setNotesSaving(true);
    const { error } = await supabase
      .from('invoices')
      .update({ delivery_notes: deliveryNotes })
      .eq('id', id!);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setInvoice(prev => prev ? { ...prev, delivery_notes: deliveryNotes } as Invoice : null);
      setNotesEdited(false);
      toast({ title: 'Saved', description: 'Delivery notes updated' });
    }
    setNotesSaving(false);
  };

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;

    const clone = el.cloneNode(true) as HTMLElement;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write('<!DOCTYPE html><html><head><title>Invoice ' + (invoice?.invoice_number || '') + '</title></head><body style="margin:0;padding:0;"></body></html>');
    printWindow.document.close();
    printWindow.document.body.appendChild(printWindow.document.adoptNode(clone));
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
  };

  const sendWhatsAppReminder = () => {
    if (!invoice) return;
    if (!invoice.customer_phone) return;
    const message = encodeURIComponent(
      `Hello ${invoice.customer_name}, \n\nYour order no.${invoice.invoice_number} from Banaras Dyeing Center is ready for pickup 😊\n\n📍 Address: 54 Alkapuri Arcade, Vadodara\n🕒 Shop Timings: 10:30am to 8:30pm, Monday to Saturday\n\nYou can collect it at your convenience during working hours.\n\nThank you for choosing Banaras Dyeing Center.`
    );
    const phone = invoice.customer_phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}?text=${message}`, '_blank');
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!invoice) return <div className="p-4 text-center text-muted-foreground">Invoice not found</div>;

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-heading text-xl font-bold">{invoice.invoice_number}</h1>
          <span className={`text-xs font-medium ${invoice.order_type === 'Urgent' ? 'text-destructive' : 'text-muted-foreground'}`}>
            {invoice.order_type}
          </span>
        </div>
        <button onClick={handlePrint} className="rounded-lg p-2 hover:bg-secondary" title="Print Invoice">
          <Printer className="h-5 w-5" />
        </button>
      </div>

      {/* Customer info */}
      <Card>
        <CardContent className="space-y-2 p-4">
          <h3 className="font-heading font-semibold text-foreground">{invoice.customer_name}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5" /> {invoice.customer_phone}
          </div>
          {invoice.customer_address && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {invoice.customer_address}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Delivery: {new Date(invoice.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </CardContent>
      </Card>

      {/* Financial summary - admin only */}
      {isAdmin && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-heading text-lg font-bold">₹{Number(invoice.total_amount).toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paid</p>
                <p className="font-heading text-lg font-bold text-success">₹{Number(invoice.amount_paid || 0).toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="font-heading text-lg font-bold text-destructive">₹{Number(invoice.balance_amount || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 font-heading text-base font-semibold">
          <Package className="h-4 w-4" /> Items ({invoice.total_pieces} pcs)
        </h3>
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{item.product_type} ({item.product_category})</p>
                    <p className="text-sm text-muted-foreground">{item.service} × {item.quantity}</p>
                    {isAdmin && (
                      <p className="mt-1 text-sm font-semibold">₹{Number(item.total).toLocaleString('en-IN')}</p>
                    )}
                  </div>
                  <Select
                    value={item.status}
                    onValueChange={(v) => {
                      if (!isAdmin && v === 'Delivered' && item.status !== 'Ready') {
                        toast({ title: 'Not allowed', description: 'Item must be Ready before marking Delivered', variant: 'destructive' });
                        return;
                      }
                      updateItemStatus(item.id, v);
                    }}
                  >
                    <SelectTrigger className={`h-8 w-28 text-xs ${statusBadgeClass[item.status]}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOrder.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Payments - admin only */}
      {isAdmin && payments.length > 0 && (
        <div>
          <h3 className="mb-3 font-heading text-base font-semibold">Payment History</h3>
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                <div>
                  <p className="text-sm font-medium">₹{Number(p.amount).toLocaleString('en-IN')}</p>
                  <p className="text-xs text-muted-foreground">{p.payment_mode} • {new Date(p.payment_date).toLocaleDateString('en-IN')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order Notes */}
      {invoice.notes && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Order Notes</p>
            <p className="mt-1 text-sm">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Delivery / Additional Notes */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Delivery / Additional Notes</p>
          <Textarea
            value={deliveryNotes}
            onChange={(e) => {
              setDeliveryNotes(e.target.value);
              setNotesEdited(true);
            }}
            placeholder="Add delivery instructions, special notes..."
            className="min-h-[80px] resize-none text-sm"
          />
          {notesEdited && (
            <Button
              size="sm"
              className="mt-2"
              onClick={saveDeliveryNotes}
              disabled={notesSaving}
            >
              <Save className="mr-1 h-3.5 w-3.5" />
              {notesSaving ? 'Saving...' : 'Save Notes'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 pb-4 pt-2">
        <Button variant="outline" className="flex-1" onClick={sendWhatsAppReminder}>
          <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
        </Button>
        <Button variant="outline" className="flex-1" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
        {isAdmin && (
          <Button className="flex-1" onClick={() => navigate(`/invoices/${id}/payment`)}>
            Add Payment
          </Button>
        )}
      </div>

      {/* Print template - offscreen but rendered */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '148mm' }}>
        <PrintInvoice ref={printRef} invoice={invoice} items={items} outlet={outlet} />
      </div>
    </div>
  );
};

export default InvoiceDetail;
