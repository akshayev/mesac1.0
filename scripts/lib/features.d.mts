// Types for features.mjs (imported by the admin server in src/server/).
export declare function isTurnstileTestKey(raw: unknown): boolean;
export declare function turnstileSiteKey(raw: unknown): string;
export declare function joinPageEnabled(env: Record<string, string | undefined>): boolean;
export declare const SALT_MIN: number;
export declare function checkFeatures(env: Record<string, string | undefined>): {
  d1: boolean;
  submissions: boolean;
  refresh: boolean;
  errors: string[];
};
export declare function refreshTokenFormat(raw: unknown): boolean;
export declare function githubRepo(raw: unknown): string;
export declare function workflowFile(raw: unknown): string;
