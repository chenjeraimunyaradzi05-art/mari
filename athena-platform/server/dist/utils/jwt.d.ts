export declare function getJwtSecretOrThrow(): string;
interface TokenPayload {
    userId: string;
    email: string;
    role: string;
    persona: string;
}
interface DecodedTokenPayload extends TokenPayload {
    exp?: number;
    iat?: number;
    jti?: string;
}
export declare const generateAccessToken: (payload: TokenPayload) => string;
export declare const generateRefreshToken: (payload: TokenPayload) => string;
export declare const verifyToken: (token: string) => TokenPayload;
export declare const decodeToken: (token: string) => DecodedTokenPayload | null;
export declare const getTokenExpiresInSeconds: (token: string) => number | null;
export {};
//# sourceMappingURL=jwt.d.ts.map