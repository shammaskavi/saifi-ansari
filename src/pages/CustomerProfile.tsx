

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Phone, MapPin, ArrowLeft } from 'lucide-react';

interface Customer {
    id: string;
    name: string;
    phone: string;
    address?: string | null;
    total_billed: number;
    total_paid: number;
    total_due: number;
}

interface InvoiceItem {
    id: string;
    invoice_number: string;
    total_amount: number;
    total_paid: number;
    total_due: number;
    created_at: string;
}

interface PaymentItem {
    id: string;
    amount: number;
    created_at: string;
    invoice_number: string;
}

export default function CustomerProfile() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
    const [payments, setPayments] = useState<PaymentItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        const fetchData = async () => {
            setLoading(true);

            // Customer summary
            const { data: customerData } = await supabase
                .from('customer_financial_summary')
                .select('*')
                .eq('id', id)
                .single();

            // Customer invoices
            const { data: invoiceData } = await supabase
                .from('invoices')
                .select(`
          id,
          invoice_number,
          created_at,
          total_amount
        `)
                .eq('customer_id', id)
                .order('created_at', { ascending: false });

            // Fetch financials separately
            const invoiceIds = (invoiceData || []).map(i => i.id);

            const { data: financials } = await supabase
                .from('invoice_financials')
                .select('id, total_paid, total_due')
                .in('id', invoiceIds.length ? invoiceIds : ['00000000-0000-0000-0000-000000000000']);

            const financialMap = new Map(
                (financials || []).map((f: any) => [f.id, f])
            );

            // Payments history (via invoice ids)
            const { data: paymentData } = await supabase
                .from('payments')
                .select(`
          id,
          amount,
          created_at,
          invoice_id
        `)
                .in('invoice_id', invoiceIds.length ? invoiceIds : ['00000000-0000-0000-0000-000000000000'])
                .order('created_at', { ascending: false });

            setCustomer(customerData as Customer);

            const mappedInvoices = (invoiceData || []).map((inv: any) => {
                const fin = financialMap.get(inv.id);

                return {
                    id: inv.id,
                    invoice_number: inv.invoice_number,
                    created_at: inv.created_at,
                    total_amount: inv.total_amount,
                    total_paid: fin?.total_paid ?? 0,
                    total_due: fin?.total_due ?? inv.total_amount,
                };
            });

            const invoiceNumberMap = new Map(
                (invoiceData || []).map((inv: any) => [inv.id, inv.invoice_number])
            );

            const mappedPayments = (paymentData || []).map((p: any) => ({
                id: p.id,
                amount: p.amount,
                created_at: p.created_at,
                invoice_number: invoiceNumberMap.get(p.invoice_id),
            }));

            setInvoices(mappedInvoices);
            setPayments(mappedPayments);

            setLoading(false);
        };

        fetchData();
    }, [id]);

    if (loading) {
        return (
            <div className="p-4 space-y-4">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    if (!customer) {
        return <div className="p-4">Customer not found</div>;
    }

    return (
        <div className="flex flex-col gap-4 p-4 pb-24">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-xl font-semibold">Customer Profile</h1>
            </div>

            {/* Customer Info */}
            <Card>
                <CardContent className="p-4 space-y-2">
                    <h2 className="text-lg font-semibold">{customer.name}</h2>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" /> {customer.phone}
                    </div>
                    {customer.address && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" /> {customer.address}
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-3 pt-3 border-t text-sm">
                        <div>
                            <p className="text-muted-foreground">Billed</p>
                            <p className="font-medium">₹{customer.total_billed.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Paid</p>
                            <p className="font-medium">₹{customer.total_paid.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Due</p>
                            <p className={`font-semibold ${customer.total_due > 0 ? 'text-destructive' : 'text-green-600'}`}>
                                ₹{customer.total_due.toLocaleString('en-IN')}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Invoices */}
            <div>
                <h2 className="font-semibold mb-2">Invoices</h2>
                <div className="space-y-2">
                    {invoices.map(inv => (
                        <Card key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} className="cursor-pointer">
                            <CardContent className="p-3 flex justify-between">
                                <div>
                                    <p className="font-medium">#{inv.invoice_number}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(inv.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="text-right text-sm">
                                    <p>₹{inv.total_amount.toLocaleString('en-IN')}</p>
                                    <p className="text-muted-foreground">Due ₹{inv.total_due.toLocaleString('en-IN')}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Payments */}
            <div>
                <h2 className="font-semibold mb-2">Payment History</h2>
                <div className="space-y-2">
                    {payments.map(p => (
                        <Card key={p.id}>
                            <CardContent className="p-3 flex justify-between">
                                <div>
                                    <p className="font-medium">₹{p.amount.toLocaleString('en-IN')}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Invoice #{p.invoice_number}
                                    </p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {new Date(p.created_at).toLocaleDateString()}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}