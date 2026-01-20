import { Prisma } from '@prisma/client';
export interface JournalLineInput {
    accountId: string;
    debit?: number;
    credit?: number;
    description?: string;
}
export interface JournalEntryInput {
    organizationId?: string;
    userId?: string;
    description: string;
    reference?: string;
    entryDate?: string | Date;
    status?: 'DRAFT' | 'POSTED';
    lines: JournalLineInput[];
}
export declare function listAccounts(params: {
    organizationId?: string;
    userId?: string;
}): Promise<{
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    userId: string | null;
    type: import(".prisma/client").$Enums.AccountingAccountType;
    organizationId: string | null;
    currency: string;
    code: string | null;
}[]>;
export declare function createAccount(data: {
    organizationId?: string;
    userId?: string;
    name: string;
    code?: string;
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
    currency?: string;
}): Promise<{
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    userId: string | null;
    type: import(".prisma/client").$Enums.AccountingAccountType;
    organizationId: string | null;
    currency: string;
    code: string | null;
}>;
export declare function updateAccount(id: string, data: {
    name?: string;
    code?: string;
    type?: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
    currency?: string;
    isActive?: boolean;
}): Promise<{
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    userId: string | null;
    type: import(".prisma/client").$Enums.AccountingAccountType;
    organizationId: string | null;
    currency: string;
    code: string | null;
}>;
export declare function deleteAccount(id: string): Promise<{
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    userId: string | null;
    type: import(".prisma/client").$Enums.AccountingAccountType;
    organizationId: string | null;
    currency: string;
    code: string | null;
}>;
export declare function createJournalEntry(input: JournalEntryInput): Promise<{
    lines: {
        id: string;
        createdAt: Date;
        description: string | null;
        journalEntryId: string;
        accountId: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
    }[];
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string | null;
    description: string;
    status: import(".prisma/client").$Enums.JournalEntryStatus;
    organizationId: string | null;
    metadata: Prisma.JsonValue | null;
    reference: string | null;
    entryDate: Date;
    postedAt: Date | null;
}>;
export declare function listJournalEntries(params: {
    organizationId?: string;
    userId?: string;
    status?: 'DRAFT' | 'POSTED' | 'VOID';
}): Promise<({
    lines: {
        id: string;
        createdAt: Date;
        description: string | null;
        journalEntryId: string;
        accountId: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
    }[];
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string | null;
    description: string;
    status: import(".prisma/client").$Enums.JournalEntryStatus;
    organizationId: string | null;
    metadata: Prisma.JsonValue | null;
    reference: string | null;
    entryDate: Date;
    postedAt: Date | null;
})[]>;
export declare function getJournalEntry(id: string): Promise<{
    lines: {
        id: string;
        createdAt: Date;
        description: string | null;
        journalEntryId: string;
        accountId: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
    }[];
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string | null;
    description: string;
    status: import(".prisma/client").$Enums.JournalEntryStatus;
    organizationId: string | null;
    metadata: Prisma.JsonValue | null;
    reference: string | null;
    entryDate: Date;
    postedAt: Date | null;
}>;
export declare function postJournalEntry(id: string): Promise<{
    lines: {
        id: string;
        createdAt: Date;
        description: string | null;
        journalEntryId: string;
        accountId: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
    }[];
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string | null;
    description: string;
    status: import(".prisma/client").$Enums.JournalEntryStatus;
    organizationId: string | null;
    metadata: Prisma.JsonValue | null;
    reference: string | null;
    entryDate: Date;
    postedAt: Date | null;
}>;
export declare function voidJournalEntry(id: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string | null;
    description: string;
    status: import(".prisma/client").$Enums.JournalEntryStatus;
    organizationId: string | null;
    metadata: Prisma.JsonValue | null;
    reference: string | null;
    entryDate: Date;
    postedAt: Date | null;
}>;
export declare function updateJournalEntry(id: string, data: {
    description?: string;
    reference?: string;
    entryDate?: string | Date;
}): Promise<{
    lines: {
        id: string;
        createdAt: Date;
        description: string | null;
        journalEntryId: string;
        accountId: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
    }[];
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string | null;
    description: string;
    status: import(".prisma/client").$Enums.JournalEntryStatus;
    organizationId: string | null;
    metadata: Prisma.JsonValue | null;
    reference: string | null;
    entryDate: Date;
    postedAt: Date | null;
}>;
export declare function getTrialBalance(params: {
    organizationId?: string;
    userId?: string;
}): Promise<{
    accountId: string;
    name: string;
    type: string;
    debit: number;
    credit: number;
}[]>;
//# sourceMappingURL=accounting.service.d.ts.map