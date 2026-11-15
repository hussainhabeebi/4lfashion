import {headers} from 'next/headers';
import Storefront from '../storefront';
import {publicCatalog, isPhone} from '../../lib/server-catalog';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const [h, initial] = await Promise.all([headers(), publicCatalog()]);
  return <Storefront initial={initial} mobile={isPhone(h.get('user-agent') || '')}/>;
}
