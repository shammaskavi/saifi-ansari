import React, { forwardRef } from 'react';
import type { Invoice, InvoiceItem } from '@/lib/types';
import logoDark from '@/assets/logo-dark.png';

interface Outlet {
  name: string;
  address: string | null;
  phone: string | null;
}

interface PrintInvoiceProps {
  invoice: Invoice;
  items: InvoiceItem[];
  outlet?: Outlet | null;
}

const SERVICES_LIST = ['Dry-Cleaning', 'Tassel', 'Fall-Beding', 'Net', 'Polishing & more'];
const MIN_ROWS = 18;

const PrintInvoice = forwardRef<HTMLDivElement, PrintInvoiceProps>(
  ({ invoice, items, outlet }, ref) => {
    const paddedItems = [...items];
    while (paddedItems.length < MIN_ROWS) {
      paddedItems.push(null as any);
    }

    return (
      <div ref={ref} className="print-invoice">
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-invoice, .print-invoice * { visibility: visible; }
            .print-invoice {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            @page { margin: 6mm; size: A5; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          }
          .print-invoice {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #333;
            max-width: 148mm;
            margin: 0 auto;
            background: #fff;
            font-size: 11px;
            line-height: 1.4;
          }
          .pi-header {
            background: #b85c3c !important;
            color: #fff !important;
            padding: 14px 16px 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .pi-brand {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .pi-brand-logo {
            width: 50px;
            height: 50px;
            object-fit: contain;
            border-radius: 4px;
          }
          .pi-brand-text h1 {
            font-size: 28px;
            font-weight: 800;
            margin: 0;
            line-height: 1;
            font-family: Georgia, 'Times New Roman', serif;
            color: #fff;
          }
          .pi-brand-text .pi-sub {
            font-size: 11px;
            margin: 0;
            opacity: 0.9;
            color: #fff;
          }
          .pi-services {
            text-align: right;
            font-size: 10px;
            line-height: 1.5;
            color: #fff;
          }
          .pi-address-bar {
            background: #d4856b !important;
            color: #fff !important;
            padding: 5px 16px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            font-weight: 500;
          }
          .pi-body {
            border: 1.5px solid #b85c3c;
            border-top: none;
          }
          .pi-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            border-bottom: 1.5px solid #b85c3c;
          }
          .pi-info-left {
            padding: 8px 12px;
            border-right: 1.5px solid #b85c3c;
          }
          .pi-info-right {
            display: flex;
            flex-direction: column;
          }
          .pi-info-row {
            padding: 5px 12px;
            border-bottom: 1px solid #d4856b;
            font-size: 10px;
          }
          .pi-info-row:last-child { border-bottom: none; }
          .pi-info-row strong { color: #b85c3c; }
          .pi-table { width: 100%; border-collapse: collapse; }
          .pi-table th {
            background: #b85c3c !important;
            color: #fff !important;
            padding: 5px 10px;
            text-align: left;
            font-size: 10px;
            font-weight: 600;
          }
          .pi-table th:last-child { text-align: right; }
          .pi-table td {
            padding: 4px 10px;
            border-bottom: 1px solid #e8c4b8;
            font-size: 10px;
            min-height: 20px;
          }
          .pi-table td:first-child { width: 36px; text-align: center; }
          .pi-table td:last-child { text-align: right; width: 80px; }
          .pi-total {
            display: flex;
            justify-content: space-between;
            padding: 7px 12px;
            border-top: 2px solid #b85c3c;
            font-weight: 700;
            font-size: 12px;
          }
          .pi-notes {
            padding: 6px 12px 8px;
            border-top: 1px solid #d4856b;
            font-size: 10px;
            min-height: 30px;
          }
          .pi-notes strong { color: #b85c3c; }
          .pi-footer {
            display: flex;
            justify-content: space-between;
            padding: 5px 16px;
            font-size: 9px;
            color: #666;
          }
          .pi-footer .thanks { color: #b85c3c; font-weight: 700; font-size: 11px; }
        `}</style>

        {/* Header */}
        <div className="pi-header">
          <div className="pi-brand">
            <img src={logoDark} alt="Banaras Dyeing" className="pi-brand-logo" />
            <div className="pi-brand-text">
              <p className="pi-sub" style={{ letterSpacing: '1px' }}>banaras</p>
              <h1>Dyeing</h1>
              <p className="pi-sub">since 1964</p>
            </div>
          </div>
          <div className="pi-services">
            {SERVICES_LIST.map(s => <div key={s}>{s}</div>)}
          </div>
        </div>

        {/* Address bar */}
        <div className="pi-address-bar">
          <span>{outlet?.address || 'Alkapuri Arcade, R.C Dutt Road, Vadodara - 390 007'}</span>
          <span>{outlet?.phone || '+91 99984 08644'}</span>
        </div>

        {/* Body */}
        <div className="pi-body">
          <div className="pi-info">
            <div className="pi-info-left">
              <div style={{ fontSize: '10px', color: '#b85c3c', fontWeight: 600 }}>To M/s,</div>
              <div style={{ fontSize: '12px', fontWeight: 600, marginTop: 2 }}>{invoice.customer_name}</div>
              {invoice.customer_phone && (
                <div style={{ fontSize: '10px', color: '#666', marginTop: 1 }}>{invoice.customer_phone}</div>
              )}
              {invoice.customer_address && (
                <div style={{ fontSize: '10px', color: '#666', marginTop: 1 }}>{invoice.customer_address}</div>
              )}
            </div>
            <div className="pi-info-right">
              <div className="pi-info-row"><strong>Bill Number:</strong> {invoice.invoice_number}</div>
              <div className="pi-info-row"><strong>Bill Date:</strong> {new Date(invoice.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              <div className="pi-info-row"><strong>Delivery Date:</strong> {new Date(invoice.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>
          </div>

          <table className="pi-table">
            <thead>
              <tr>
                <th>S.No.</th>
                <th>Particulars</th>
                <th>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {paddedItems.map((item, idx) => (
                <tr key={idx}>
                  <td>{item ? idx + 1 : ''}</td>
                  <td>
                    {item
                      ? `${item.product_type} (${item.product_category}) - ${item.service} × ${item.quantity}`
                      : '\u00A0'}
                  </td>
                  <td>{item ? `₹${Number(item.total).toLocaleString('en-IN')}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pi-total">
            <span>TOTAL AMOUNT:</span>
            <span>₹{Number(invoice.total_amount).toLocaleString('en-IN')}</span>
          </div>

          <div className="pi-notes">
            <strong>Additional Note:</strong>
            <div style={{ marginTop: 2 }}>
              {invoice.delivery_notes || invoice.notes || ''}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pi-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span>Monday to Saturday, 10:00 AM to 8:30 PM</span>
            <span>No deliveries will be handed out w/o the invoice.</span>
            <span> We are not responsible for garments w/o bill</span>
            <span>For oder pickup & enquires +91 84606 79330</span>
          </div>
          <span className="thanks">THANK YOU</span>
        </div>
      </div>
    );
  }
);

PrintInvoice.displayName = 'PrintInvoice';

export default PrintInvoice;
