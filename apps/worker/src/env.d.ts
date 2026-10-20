export {};

declare global {
  interface Env {
    /** Secrets are provisioned with `wrangler secret put`, never committed. */
    SUPABASE_URL: string;
    SUPABASE_SECRET_KEY: string;
  }
}
