import type { Metadata } from 'next';import './globals.css';
export const metadata:Metadata={title:'4L Fashion | Everyday elegance, Doha',description:'Discover contemporary ethnic wear, considered essentials and occasion dressing at 4L Fashion, Old Airport Street, Doha, Qatar.',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'4L Fashion',statusBarStyle:'default'},icons:{icon:'/favicon.svg',apple:'/icon-192-3d.png'}};
export const viewport={width:'device-width',initialScale:1,themeColor:'#651f34'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><head><style dangerouslySetInnerHTML={{__html:SPLASH_CSS}}/><script dangerouslySetInnerHTML={{__html:SPLASH_SEEN}}/><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/><link rel="preconnect" href="https://images.unsplash.com"/><link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"/><script dangerouslySetInnerHTML={{__html:"(function(){var l=document.createElement('link');l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap';document.head.appendChild(l)})()"}}/><noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"/></noscript></head><body><div id="splash" aria-hidden="true"><span className="mark"><em>4L</em><small>FASHION</small></span><i><b/></i></div><script dangerouslySetInnerHTML={{__html:SPLASH_JS}}/>{children}</body></html>}
// Loading screen: shown from the first paint on the first visit of a session, it fades out
// as soon as the first-screen photos (the high-priority ones) have fully loaded, and never
// stays longer than 2 seconds. Inline so it paints before the main stylesheet arrives;
// the CSS animation hides it on its own if scripts are blocked.
const SPLASH_CSS=`#splash{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:#faf8f4;transition:opacity .3s ease,visibility .3s;animation:splash-out .3s 2.4s forwards}
#splash .mark{width:88px;height:88px;border-radius:50%;background:#1d1416;color:#f4e6d4;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 0 0 3px #651f34,0 10px 30px -12px #651f34;animation:splash-pulse 1.4s ease-in-out infinite}
#splash em{font:italic 500 34px/1 Georgia,'Times New Roman',serif;letter-spacing:-1px}
#splash small{font:600 8px/1 Arial,sans-serif;letter-spacing:2px;margin-top:4px;color:#d9b98c}
#splash i{display:block;width:120px;height:3px;border-radius:3px;background:#eadfd6;overflow:hidden}
#splash b{display:block;height:100%;width:100%;background:#651f34;transform-origin:left;animation:splash-bar 2s cubic-bezier(.2,.7,.3,1) forwards}
html.splash-done #splash,html.splash-seen #splash{opacity:0;visibility:hidden;pointer-events:none}
html.splash-seen #splash{transition:none}
@keyframes splash-bar{from{transform:scaleX(.04)}to{transform:scaleX(1)}}
@keyframes splash-pulse{50%{transform:scale(.94);opacity:.85}}
@keyframes splash-out{to{opacity:0;visibility:hidden;pointer-events:none}}
@media(prefers-reduced-motion:reduce){#splash .mark{animation:none}}`;
const SPLASH_SEEN=`try{if(sessionStorage.getItem('4l-splash'))document.documentElement.classList.add('splash-seen')}catch(e){}`;
const SPLASH_JS=`(function(){var h=document.documentElement,done=false;
function hide(){if(done)return;done=true;h.classList.add('splash-done');try{sessionStorage.setItem('4l-splash','1')}catch(e){}}
if(h.classList.contains('splash-seen'))return;
setTimeout(hide,2000);
function check(){var imgs=document.querySelectorAll('img[fetchpriority=high]'),waiting=0;
for(var k=0;k<imgs.length;k++){var im=imgs[k];if(!(im.complete&&im.naturalWidth)){waiting++;im.addEventListener('load',check,{once:true});im.addEventListener('error',check,{once:true})}}
if(!waiting){var d=document.fonts&&document.fonts.ready;(d?Promise.race([d,new Promise(function(r){setTimeout(r,250)})]):Promise.resolve()).then(hide)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',check);else check();})();`;
