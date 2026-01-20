/**
 * Invoice PDF Generation Service
 * Generates professional PDF invoices for payments
 * Phase 2: Backend Logic & Integrations
 */
export interface InvoiceLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxRate?: number;
    taxAmount?: number;
}
export interface InvoiceData {
    invoiceNumber: string;
    invoiceDate: Date;
    dueDate: Date;
    status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    seller: {
        name: string;
        address: string[];
        email: string;
        phone?: string;
        taxId?: string;
        logo?: string;
    };
    buyer: {
        name: string;
        email: string;
        address?: string[];
        taxId?: string;
    };
    items: InvoiceLineItem[];
    subtotal: number;
    taxTotal: number;
    discount?: number;
    total: number;
    currency: string;
    paymentMethod?: string;
    paymentDate?: Date;
    transactionId?: string;
    notes?: string;
    terms?: string;
}
/**
 * Generate a PDF invoice
 */
export declare function generateInvoicePDF(invoiceData: InvoiceData, outputPath?: string): Promise<Buffer>;
/**
 * Generate and store invoice for a payment
 */
export declare function createInvoiceForPayment(paymentId: string, options?: {
    sendEmail?: boolean;
}): Promise<{
    invoiceId: string;
    pdf: Buffer;
}>;
/**
 * Generate invoice for subscription
 */
export declare function createInvoiceForSubscription(subscriptionId: string): Promise<{
    invoiceId: string;
    pdf: Buffer;
}>;
/**
 * Get invoice by ID
 */
export declare function getInvoice(invoiceId: string): Promise<any>;
/**
 * Get user's invoices
 */
export declare function getUserInvoices(userId: string): Promise<any[]>;
export declare const invoiceService: {
    generateInvoicePDF: typeof generateInvoicePDF;
    createInvoiceForPayment: typeof createInvoiceForPayment;
    createInvoiceForSubscription: typeof createInvoiceForSubscription;
    getInvoice: typeof getInvoice;
    getUserInvoices: typeof getUserInvoices;
};
//# sourceMappingURL=invoice.service.d.ts.map