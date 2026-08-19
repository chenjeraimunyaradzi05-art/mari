export interface LaunchReadinessDocCheck {
    name: string;
    ok: boolean;
    details?: string;
}
export interface LaunchReadinessDocValidationResult {
    ok: boolean;
    checks: LaunchReadinessDocCheck[];
}
export declare function validateLaunchReadinessDocs(): LaunchReadinessDocValidationResult;
//# sourceMappingURL=validate-launch-readiness.d.ts.map