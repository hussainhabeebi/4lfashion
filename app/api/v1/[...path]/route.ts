import {env} from 'cloudflare:workers';
import {handleApiRequest} from '../../../../lib/integrations';
// /api/v1/ping, /api/v1/orders[/id], /api/v1/products[/id], /api/v1/inventory. See docs/API_INTEGRATIONS.md.
export const dynamic = 'force-dynamic';
const handle = (req: Request) => handleApiRequest((env as any).DB, req, (env as any).APP_URL || '');
export const GET = handle, POST = handle, PUT = handle, PATCH = handle, DELETE = handle, OPTIONS = handle;
