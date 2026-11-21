import {env} from 'cloudflare:workers';
import {handleApiRequest} from '../../../lib/integrations';
// Read-only store API for connected platforms (Leadvyne, CRMs, Zapier...). Keys: Admin → Integrations.
export const dynamic = 'force-dynamic';
const handle = (req: Request) => handleApiRequest((env as any).DB, req, (env as any).APP_URL || '');
export const GET = handle, POST = handle, PUT = handle, PATCH = handle, DELETE = handle, OPTIONS = handle;
