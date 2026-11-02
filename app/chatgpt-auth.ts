// Compatibility names for existing imports. Identity now comes exclusively from Google sessions.
export {getCurrentUser as getChatGPTUser} from './auth';
export function chatGPTSignInPath(returnTo='/admin'){return '/admin/login?return_to='+encodeURIComponent(returnTo)}
export function chatGPTSignOutPath(){return '/admin/login'}
