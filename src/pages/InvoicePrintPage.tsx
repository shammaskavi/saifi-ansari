import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PrintInvoice from '@/components/PrintInvoice';


interface Invoice {
    id: string;
    invoice_number: string;
    customer_id: string;
    total_amount: number;
    created_at: string;
}

interface Item {
    id: string;
    product_type: string;
    quantity: number;
    rate: number;
    services: string[];
}

interface Outlet {
    id: string;
    name: string;
    address?: string;
    phone?: string;
}

export default function InvoicePrintPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [items, setItems] = useState<Item[]>([]);
    const [outlet, setOutlet] = useState<Outlet | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        const loadData = async () => {
            setLoading(true);

            // Wait for Supabase auth session (important for print route)
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData?.session) {
                console.error('No Supabase session available for print page');
                setLoading(false);
                return;
            }

            // Fetch invoice
            const { data: invoiceData, error: invoiceError } = await supabase
                .from('invoices')
                .select(`
                    *,
                    customers(name, phone, address)
                `)
                .eq('id', id)
                .single();

            if (invoiceError || !invoiceData) {
                console.error('Invoice load error', invoiceError);
                setLoading(false);
                return;
            }

            setInvoice({
                ...invoiceData,
                customer_name: invoiceData.customers?.name ?? '',
                customer_phone: invoiceData.customers?.phone ?? null,
                customer_address: invoiceData.customers?.address ?? null,
            });

            // Fetch items
            const { data: itemsData } = await supabase
                .from('invoice_items')
                .select('*')
                .eq('invoice_id', id)
                .order('created_at');

            setItems(itemsData || []);

            // Fetch outlet
            const { data: outletData } = await supabase
                .from('outlets')
                .select('id,name,address,phone')
                .eq('id', invoiceData.outlet_id)
                .single();

            setOutlet(outletData || null);

            setLoading(false);
        };

        loadData();
    }, [id]);

    /**
     * Mobile-safe auto print
     * Wait until layout + fonts + images render
     */
    useEffect(() => {
        if (!invoice || loading) return;

        const timer = setTimeout(() => {
            window.print();
        }, 800);

        return () => clearTimeout(timer);
    }, [invoice, loading]);

    /**
     * Optional: auto close after print
     */
    useEffect(() => {
        const handleAfterPrint = () => {
            navigate(-1);
        };

        window.addEventListener('afterprint', handleAfterPrint);

        return () => {
            window.removeEventListener('afterprint', handleAfterPrint);
        };
    }, [navigate]);

    if (loading || !invoice || !outlet) {
        return (
            <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
                Preparing invoice preview...
            </div>
        );
    }

    return (
        <div>
            <PrintInvoice invoice={invoice} items={items} outlet={outlet} />
        </div>
    );
}