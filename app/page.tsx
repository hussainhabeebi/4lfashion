import {headers} from 'next/headers';
import Storefront from './storefront';
import {publicCatalog, isPhone, leadImages} from '../lib/server-catalog';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const [h, initial] = await Promise.all([headers(), publicCatalog()]);
  return <>
    {/* The homepage grid's first two photos start downloading before the page body is read. */}
    {leadImages(initial).map(src => <link key={src} rel="preload" as="image" href={src} fetchPriority="high"/>)}
    <Storefront initial={initial} mobile={isPhone(h.get('user-agent') || '')}/>
  </>;
}
