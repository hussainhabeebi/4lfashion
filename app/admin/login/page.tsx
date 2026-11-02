import {env} from 'cloudflare:workers';import {missingConfig} from '../../../lib/auth-core';import GoogleLogin from './google-login';
export const dynamic='force-dynamic';export default function Page(){return <GoogleLogin missing={missingConfig(env)} ownerConfigured={!!env.OWNER_EMAIL}/>}
