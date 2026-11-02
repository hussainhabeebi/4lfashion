declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    APP_URL?: string;
    OWNER_EMAIL?: string;
    BUCKET?: R2Bucket;
  }
}
