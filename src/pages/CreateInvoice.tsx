import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';
import CreateCustomerModal from '@/components/customers/CreateCustomerModal';

interface ItemForm {
  product_category: 'Saree' | 'Garment';
  product_type: string;
  services: string[];
  quantity: number | '';
  rate: number | '';
}

const PRODUCT_TYPES = {

  Saree: ['Silk', 'Cotton', 'Banarasi', 'South Silk', 'Rajkot Patola', 'Other'],
  Garment: ['Shirt', 'Pant', 'Blazer', 'Blouse', 'Lehenga', 'Woolen', 'Top', 'Kurta', 'Salwar', 'Dupatta', 'Gown', 'Jacket', 'Other'],

};

const SERVICES = ['Wash/Press', 'Polish', 'Tassel', 'Fall-Beading', 'Net', 'Dry-Cleaning', 'Other'];

const CreateInvoice: React.FC = () => {
  const { user, isAdmin, outletId, outlets } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [selectedOutlet, setSelectedOutlet] = useState(outletId || '');
  const effectiveOutletId = selectedOutlet || outletId;
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  React.useEffect(() => {
    const loadCustomers = async () => {
      const { data } = await (supabase as any)
        .from('customers')
        .select('*')
        .eq('outlet_id', effectiveOutletId)
        .order('name');

      if (data) setCustomers(data);
    };

    loadCustomers();
  }, [effectiveOutletId]);
  const filteredCustomers = customers.filter(c =>
    customerSearch && (
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone?.includes(customerSearch)
    )
  );
  const [deliveryDate, setDeliveryDate] = useState('');
  const [orderType, setOrderType] = useState<'Normal' | 'Urgent'>('Normal');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemForm[]>([
    { product_category: 'Saree', product_type: '', services: [], quantity: '', rate: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const addItem = () => {
    setItems([...items, { product_category: 'Saree', product_type: '', services: [], quantity: '', rate: '' }]);
  };

  const removeItem = (idx: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof ItemForm, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    if (field === 'product_category') {
      updated[idx].product_type = '';
      updated[idx].services = [];
    }
    setItems(updated);
  };

  const totalPieces = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const totalAmount = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.rate) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !selectedOutlet ||
      !customerId ||
      !deliveryDate ||
      items.some(i =>
        !i.product_type ||
        i.services.length === 0 ||
        !i.quantity ||
        Number(i.quantity) <= 0 ||
        (isAdmin && (i.rate === '' || Number(i.rate) < 0))
      )
    ) {
      toast({ title: 'Missing fields', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      // Generate invoice number
      const { data: invNum, error: numErr } = await supabase.rpc('generate_invoice_number', {
        _outlet_id: selectedOutlet,
      });
      if (numErr) throw numErr;

      // Create invoice
      const { data: invoice, error: invErr } = await supabase.from('invoices').insert({
        invoice_number: invNum as string,
        outlet_id: selectedOutlet,
        customer_id: customerId,
        delivery_date: deliveryDate,
        order_type: orderType,
        notes: notes.trim() || null,
        total_pieces: totalPieces,
        total_amount: totalAmount,
        created_by: user.id,
      }).select('id').single();
      if (invErr) throw invErr;

      // Create items
      const { error: itemErr } = await supabase.from('invoice_items').insert(
        items.map(item => ({
          invoice_id: invoice.id,
          product_category: item.product_category,
          product_type: item.product_type,
          service: item.services.join(', '),
          quantity: item.quantity,
          rate: isAdmin ? item.rate : 0,
        }))
      );
      if (itemErr) throw itemErr;

      toast({ title: 'Invoice Created', description: `Invoice ${invNum} created successfully` });
      navigate(`/invoices/${invoice.id}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="mb-6 font-heading text-2xl font-bold">New Invoice</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Outlet selection */}
        {isAdmin && (
          <div className="space-y-2">
            <Label>Outlet</Label>
            <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select outlet" /></SelectTrigger>
              <SelectContent>
                {outlets.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.name} ({o.prefix})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Customer selection */}
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h3 className="font-heading text-base font-semibold">Customer</h3>

          <div className="space-y-2">
            <Label>Customer *</Label>
            <Input
              value={customerSearch}
              onChange={e => {
                setCustomerSearch(e.target.value);
                setCustomerId('');
              }}
              placeholder="Search or type customer name"
              className="h-11"
            />

            {customerSearch && !customerId && (
              <div className="max-h-48 overflow-y-auto rounded-md border bg-background">
                {filteredCustomers.map(c => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      setCustomerId(c.id);
                      setCustomerSearch(`${c.name} (${c.phone})`);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-muted"
                  >
                    {c.name} ({c.phone})
                  </button>
                ))}

                {filteredCustomers.length === 0 && customerSearch.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateCustomer(true);
                    }}
                    className="w-full px-3 py-2 text-left text-primary hover:bg-muted"
                  >
                    + Create "{customerSearch}" as new customer
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Order details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Delivery Date *</Label>
            <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="h-11" required />
          </div>
          <div className="space-y-2">
            <Label>Order Type</Label>
            <Select value={orderType} onValueChange={(v) => setOrderType(v as 'Normal' | 'Urgent')}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-base font-semibold">Items</h3>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-1 h-3 w-3" /> Add Item
            </Button>
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Item {idx + 1}</span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Select value={item.product_category} onValueChange={(v) => updateItem(idx, 'product_category', v)}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Saree">Saree</SelectItem>
                      <SelectItem value="Garment">Garment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type *</Label>
                  <Select value={item.product_type} onValueChange={(v) => updateItem(idx, 'product_type', v)}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES[item.product_category].map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Services *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SERVICES.map(service => (
                    <label key={service} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.services.includes(service)}
                        onChange={e => {
                          const updated = [...items];
                          const current = updated[idx].services;

                          if (e.target.checked) {
                            updated[idx].services = [...current, service];
                          } else {
                            updated[idx].services = current.filter(s => s !== service);
                          }

                          setItems(updated);
                        }}
                      />
                      {service}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity ?? ''}
                    onChange={e => updateItem(idx, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                    className="h-10"
                  />
                </div>
                {isAdmin && (
                  <div className="space-y-1">
                    <Label className="text-xs">Rate (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={item.rate ?? ''}
                      onChange={e => updateItem(idx, 'rate', e.target.value === '' ? '' : Number(e.target.value))}
                      className="h-10"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..." />
        </div>

        {/* Summary */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Pieces</span>
            <span className="font-semibold">{totalPieces}</span>
          </div>
          {isAdmin && (
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-heading text-lg font-bold text-primary">₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="pb-4 pt-2">
          <Button type="submit" className="h-12 w-full text-base" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Invoice'}
          </Button>
        </div>
      </form>

      <CreateCustomerModal
        open={showCreateCustomer}
        onOpenChange={setShowCreateCustomer}
        outletId={effectiveOutletId}
        onCustomerSaved={(customer) => {
          setCustomers(prev => [...prev, customer]);
          setCustomerId(customer.id);
          setCustomerSearch(`${customer.name} (${customer.phone})`);
        }}
      />
    </div>
  );
};

export default CreateInvoice;
