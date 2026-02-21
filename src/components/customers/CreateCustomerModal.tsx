import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    outletId: string | null;
    customer?: any | null; // present when editing
    onCustomerSaved?: (customer: any) => void;
}

const CreateCustomerModal: React.FC<Props> = ({
    open,
    onOpenChange,
    outletId,
    customer,
    onCustomerSaved,
}) => {
    const { toast } = useToast();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;

        if (customer) {
            // Edit mode
            setName(customer.name || '');
            setPhone(customer.phone || '');
            setAddress(customer.address || '');
        } else {
            // Create mode
            setName('');
            setPhone('');
            setAddress('');
        }
    }, [open, customer]);

    const handleSave = async () => {
        if (!name.trim()) {
            toast({
                title: 'Name required',
                description: 'Customer name is required.',
                variant: 'destructive',
            });
            return;
        }

        if (!phone.trim()) {
            toast({
                title: 'Mobile number required',
                description: 'Phone number is mandatory.',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);

        let result;

        if (customer) {
            // UPDATE CUSTOMER
            result = await supabase
                .from('customers')
                .update({
                    name: name.trim(),
                    phone: phone.trim(),
                    address: address.trim() || null,
                })
                .eq('id', customer.id)
                .select()
                .single();
        } else {
            // CREATE CUSTOMER
            if (!outletId) {
                toast({
                    title: 'Outlet missing',
                    description: 'Please select an outlet first.',
                    variant: 'destructive',
                });
                setLoading(false);
                return;
            }

            result = await supabase
                .from('customers')
                .insert({
                    name: name.trim(),
                    phone: phone.trim(),
                    address: address.trim() || null,
                    outlet_id: outletId,
                })
                .select()
                .single();
        }

        const { data, error } = result;

        setLoading(false);

        if (error) {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
            return;
        }

        onCustomerSaved?.(data);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {customer ? 'Edit Customer' : 'Create Customer'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                    <div>
                        <Label>Name</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} />
                    </div>

                    <div>
                        <Label>Phone *</Label>
                        <Input value={phone} onChange={e => setPhone(e.target.value)} />
                    </div>

                    <div>
                        <Label>Address</Label>
                        <Textarea
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            placeholder="Customer address"
                        />
                    </div>

                    <Button onClick={handleSave} disabled={loading}>
                        {loading
                            ? customer
                                ? 'Updating...'
                                : 'Creating...'
                            : customer
                                ? 'Update Customer'
                                : 'Create Customer'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CreateCustomerModal;