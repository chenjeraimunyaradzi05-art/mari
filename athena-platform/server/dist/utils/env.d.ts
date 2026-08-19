/**
 * Environment Variable Validation
 * Validates required environment variables at startup
 * Step: Security hardening - fail fast if critical config is missing
 */
interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export declare function validateEnvironment(): ValidationResult;
export declare function validateEnvironmentOrExit(): void;
export {};
//# sourceMappingURL=env.d.ts.map