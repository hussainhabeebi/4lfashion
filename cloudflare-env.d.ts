declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    APP_URL?: string;
    OWNER_EMAIL?: string;
    BUCKET?: R2Bucket;
    // Cloudflare Workers AI (fit memory, photo fit match, occasion planner)
    AI?: Ai;
    // Order notifications (see docs/NOTIFICATIONS.md)
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
    WHATSAPP_TOKEN?: string;
    WHATSAPP_PHONE_NUMBER_ID?: string;
    WHATSAPP_TEMPLATE?: string;
    WHATSAPP_TEMPLATE_LANG?: string;
  }
}
