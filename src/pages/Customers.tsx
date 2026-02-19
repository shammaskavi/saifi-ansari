

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Phone, MapPin, ChevronRight } from 'lucide-react';

interface CustomerSummary {
    id: string;
    name: string;
    phone: string;
    address?: string | null;
    total_billed: number;
    total_paid: number;
    total_due: number;
}

export default function Customers() {
    const navigate = useNavigate();

    const [customers, setCustomers] = useState<CustomerSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const fetchCustomers = async () => {
            setLoading(true);

            const { data, error } = await supabase
                .from('customer_financial_summary')
                .select('*')
                .order('name');

            if (!error && data) {
                setCustomers(data as CustomerSummary[]);
            }

            setLoading(false);
        };

        fetchCustomers();
    }, []);

    const filteredCustomers = useMemo(() => {
        if (!search.trim()) return customers;

        const q = search.toLowerCase();

        return customers.filter(c =>
            c.name?.toLowerCase().includes(q) ||
            c.phone?.includes(q)
        );
    }, [customers, search]);

    return (
        <div className="flex flex-col gap-4 p-4 pb-24">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-semibold">Customers</h1>
            </div>

            {/* Search */}
            <Input
                placeholder="Search customers by name or phone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-11"
            />

            {/* List */}
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-lg" />
                    ))}
                </div>
            ) : filteredCustomers.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">
                    No customers found
                </div>
            ) : (
                <div className="grid gap-3">
                    {filteredCustomers.map(customer => {
                        const repeatCustomer = customer.total_billed > 1;

                        return (
                            <Card
                                key={customer.id}
                                className="cursor-pointer transition hover:shadow-md"
                                onClick={() => navigate(`/customers/${customer.id}`)}
                            >
                                <CardContent className="flex flex-col gap-3 p-4">
                                    {/* Top */}
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h2 className="font-semibold">
                                                    {customer.name}
                                                </h2>
                                                {repeatCustomer && (
                                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                                        Repeat
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                                <Phone className="h-4 w-4" />
                                                {customer.phone}
                                            </div>

                                            {customer.address && (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                                    <MapPin className="h-4 w-4" />
                                                    {customer.address}
                                                </div>
                                            )}
                                        </div>

                                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                    </div>

                                    {/* Financials */}
                                    <div className="grid grid-cols-3 text-sm gap-2 pt-2 border-t">
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
                        );
                    })}
                </div>
            )}
        </div>
    );
}