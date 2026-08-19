export interface AuthSessionRouteCheck {
    name: string;
    ok: boolean;
    details?: string;
}
export interface AuthSessionRouteValidationResult {
    ok: boolean;
    checks: AuthSessionRouteCheck[];
}
export declare function validateAuthSessionRoutes(): AuthSessionRouteValidationResult;
//# sourceMappingURL=validate-auth-session-routes.d.ts.map