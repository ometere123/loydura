// The Worker target deliberately excludes Node's ambient types. This minimal
// declaration lets the shared chain package use a guarded process.env access
// that Next.js can statically inline while remaining runtime-safe in Workers.
declare const process: { env: Record<string, string | undefined> };
