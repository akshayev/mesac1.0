// Types for validate.mjs (imported by the TypeScript admin server in src/server/).

export declare const FALSE_WORDS: Set<string>;
export declare const MEDIA_PATH: RegExp;
export declare function parseVisible(v: unknown): boolean;
export declare function parseConsent(v: unknown): boolean;
export declare function squash(v: unknown): string;
export declare function parseList(v: unknown): string[];
export declare function normalizePhone(v: unknown): string;
export declare function parseOrder(v: unknown): number | null;
export declare function safeUrl(v: unknown): string;
export declare function linkedinUrl(v: unknown): string;
export declare function safeEmail(v: unknown): string;
export declare function strictEmail(v: unknown): string;
export declare function contactEmail(v: unknown): string;
export declare const driveThumb: (id: string) => string;
export declare function photoUrl(v: unknown): string;
export declare function parseDate(v: unknown): string | null;
export declare function spellingUnifier(): (kind: string, value: string) => string;
export declare const SETTING_KEYS: Record<string, "text" | "email" | "url" | "link">;
export declare function settingProblem(key: string, value: string): string;
export declare function normalizeTeamDomain(raw: unknown): string;
export declare function accessAud(raw: unknown): string;
