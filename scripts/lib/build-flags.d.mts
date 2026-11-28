export declare function isDevAdminBuild(env?: Record<string, string | undefined>): boolean;
export declare function buildDefines(
  env?: Record<string, string | undefined>,
): Record<string, string>;
export declare function outputDir(
  env?: Record<string, string | undefined>,
): ".output" | ".output-dev";
