import { Prisma } from '@prisma/client';
export declare function listMoneyTransactions(params: {
    organizationId?: string;
    userId?: string;
}): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string | null;
    type: import(".prisma/client").$Enums.MoneyTransactionType;
    status: import(".prisma/client").$Enums.MoneyTransactionStatus;
    organizationId: string | null;
    currency: string;
    metadata: Prisma.JsonValue | null;
    amount: Prisma.Decimal;
    reference: string | null;
    provider: string | null;
}[]>;
export declare function createMoneyTransaction(data: {
    organizationId?: string;
    userId?: string;
    amount: number;
    currency?: string;
    type: 'PAYMENT' | 'REFUND' | 'PAYOUT' | 'TRANSFER' | 'ADJUSTMENT';
    status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
    provider?: string;
    reference?: string;
    metadata?: Record<string, any>;
}): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string | null;
    type: import(".prisma/client").$Enums.MoneyTransactionType;
    status: import(".prisma/client").$Enums.MoneyTransactionStatus;
    organizationId: string | null;
    currency: string;
    metadata: Prisma.JsonValue | null;
    amount: Prisma.Decimal;
    reference: string | null;
    provider: string | null;
}>;
export declare function updateMoneyTransaction(id: string, data: {
    status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
    provider?: string;
    reference?: string;
    metadata?: Record<string, any>;
}): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string | null;
    type: import(".prisma/client").$Enums.MoneyTransactionType;
    status: import(".prisma/client").$Enums.MoneyTransactionStatus;
    organizationId: string | null;
    currency: string;
    metadata: Prisma.JsonValue | null;
    amount: Prisma.Decimal;
    reference: string | null;
    provider: string | null;
}>;
export declare function deleteMoneyTransaction(id: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string | null;
    type: import(".prisma/client").$Enums.MoneyTransactionType;
    status: import(".prisma/client").$Enums.MoneyTransactionStatus;
    organizationId: string | null;
    currency: string;
    metadata: Prisma.JsonValue | null;
    amount: Prisma.Decimal;
    reference: string | null;
    provider: string | null;
}>;
//# sourceMappingURL=money.service.d.ts.map