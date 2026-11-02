import {headers} from 'next/headers';import {env} from 'cloudflare:workers';import {sessionUser} from '../lib/auth-core';
export async function getCurrentUser(){return sessionUser(env,(await headers()).get('cookie'))}
