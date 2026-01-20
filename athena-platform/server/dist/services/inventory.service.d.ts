import { Prisma } from '@prisma/client';
export declare function listItems(params: {
    organizationId?: string;
}): Promise<{
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    description: string | null;
    organizationId: string | null;
    currency: string;
    cost: Prisma.Decimal;
    sku: string;
    unit: string;
    valuationMethod: import(".prisma/client").$Enums.InventoryValuationMethod;
    price: Prisma.Decimal;
}[]>;
export declare function createItem(data: {
    organizationId?: string;
    sku: string;
    name: string;
    description?: string;
    unit?: string;
    valuationMethod?: 'FIFO' | 'LIFO' | 'AVERAGE';
    currency?: string;
    cost?: number;
    price?: number;
}): Promise<{
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    description: string | null;
    organizationId: string | null;
    currency: string;
    cost: Prisma.Decimal;
    sku: string;
    unit: string;
    valuationMethod: import(".prisma/client").$Enums.InventoryValuationMethod;
    price: Prisma.Decimal;
}>;
export declare function updateItem(id: string, data: {
    sku?: string;
    name?: string;
    description?: string;
    unit?: string;
    valuationMethod?: 'FIFO' | 'LIFO' | 'AVERAGE';
    currency?: string;
    cost?: number;
    price?: number;
    isActive?: boolean;
}): Promise<{
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    description: string | null;
    organizationId: string | null;
    currency: string;
    cost: Prisma.Decimal;
    sku: string;
    unit: string;
    valuationMethod: import(".prisma/client").$Enums.InventoryValuationMethod;
    price: Prisma.Decimal;
}>;
export declare function deleteItem(id: string): Promise<{
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    description: string | null;
    organizationId: string | null;
    currency: string;
    cost: Prisma.Decimal;
    sku: string;
    unit: string;
    valuationMethod: import(".prisma/client").$Enums.InventoryValuationMethod;
    price: Prisma.Decimal;
}>;
export declare function listLocations(params: {
    organizationId?: string;
}): Promise<{
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    organizationId: string | null;
    code: string;
    address: string | null;
}[]>;
export declare function createLocation(data: {
    organizationId?: string;
    name: string;
    code: string;
    address?: string;
}): Promise<{
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    organizationId: string | null;
    code: string;
    address: string | null;
}>;
export declare function updateLocation(id: string, data: {
    name?: string;
    code?: string;
    address?: string;
    isActive?: boolean;
}): Promise<{
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    organizationId: string | null;
    code: string;
    address: string | null;
}>;
export declare function deleteLocation(id: string): Promise<{
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    organizationId: string | null;
    code: string;
    address: string | null;
}>;
export declare function listTransactions(params: {
    itemId?: string;
    organizationId?: string;
}): Promise<({
    location: {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        organizationId: string | null;
        code: string;
        address: string | null;
    } | null;
    item: {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        description: string | null;
        organizationId: string | null;
        currency: string;
        cost: Prisma.Decimal;
        sku: string;
        unit: string;
        valuationMethod: import(".prisma/client").$Enums.InventoryValuationMethod;
        price: Prisma.Decimal;
    };
} & {
    id: string;
    createdAt: Date;
    type: import(".prisma/client").$Enums.InventoryTransactionType;
    reference: string | null;
    itemId: string;
    locationId: string | null;
    createdByUserId: string | null;
    quantity: Prisma.Decimal;
    unitCost: Prisma.Decimal | null;
    totalCost: Prisma.Decimal | null;
    occurredAt: Date;
})[]>;
export declare function createTransaction(data: {
    itemId: string;
    locationId?: string;
    createdByUserId?: string;
    type: 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN';
    quantity: number;
    unitCost?: number;
    totalCost?: number;
    reference?: string;
    occurredAt?: string | Date;
}): Promise<{
    id: string;
    createdAt: Date;
    type: import(".prisma/client").$Enums.InventoryTransactionType;
    reference: string | null;
    itemId: string;
    locationId: string | null;
    createdByUserId: string | null;
    quantity: Prisma.Decimal;
    unitCost: Prisma.Decimal | null;
    totalCost: Prisma.Decimal | null;
    occurredAt: Date;
}>;
export declare function updateTransaction(id: string, data: {
    locationId?: string;
    type?: 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN';
    quantity?: number;
    unitCost?: number;
    totalCost?: number;
    reference?: string;
    occurredAt?: string | Date;
}): Promise<{
    id: string;
    createdAt: Date;
    type: import(".prisma/client").$Enums.InventoryTransactionType;
    reference: string | null;
    itemId: string;
    locationId: string | null;
    createdByUserId: string | null;
    quantity: Prisma.Decimal;
    unitCost: Prisma.Decimal | null;
    totalCost: Prisma.Decimal | null;
    occurredAt: Date;
}>;
export declare function deleteTransaction(id: string): Promise<{
    id: string;
    createdAt: Date;
    type: import(".prisma/client").$Enums.InventoryTransactionType;
    reference: string | null;
    itemId: string;
    locationId: string | null;
    createdByUserId: string | null;
    quantity: Prisma.Decimal;
    unitCost: Prisma.Decimal | null;
    totalCost: Prisma.Decimal | null;
    occurredAt: Date;
}>;
export declare function getStockLevels(params: {
    organizationId?: string;
}): Promise<{
    itemId: string;
    sku: string;
    name: string;
    locationId?: string;
    location?: string;
    quantity: number;
}[]>;
//# sourceMappingURL=inventory.service.d.ts.map