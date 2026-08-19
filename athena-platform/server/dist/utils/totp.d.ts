export declare function generateTotpSecret(bytes?: number): string;
export declare function buildTotpAuthUrl(params: {
    issuer: string;
    accountName: string;
    secret: string;
}): string;
export declare function verifyTotpCode(code: string, secret: string, now?: number): boolean;
export declare function normalizeTotpCode(code: unknown): string | null;
//# sourceMappingURL=totp.d.ts.map