// Sizes the store sells, smallest first. XS and S were retired: existing XS/S
// stock records are kept but hidden and cannot be ordered.
export const SIZES=['M','L','XL','XXL','3XL','4XL','5XL'];
export const RETIRED_SIZES=['XS','S'];
// Occasions a product can be tagged with (several allowed, stored comma-separated in `occasion`).
export const occasions=['Eid','Wedding','Onam','Everyday'];
export const occasionList=(v:unknown)=>String(v||'').split(',').map(s=>s.trim()).filter(Boolean);
// Standard occasions first, then any custom occasions used on products.
export const allOccasions=(products:{occasion?:unknown}[])=>[...new Set([...occasions,...products.flatMap(p=>occasionList(p.occasion))])];
export const categories=['All pieces','Salwar suits','Kurtas & sets','Occasion wear','Everyday essentials'];
export const products=[
{id:'p1',name:'The Gulmohar Silk Set',category:'Salwar suits',price:285,oldPrice:345,colour:'Wine',fabric:'Silk blend',occasion:'Wedding',fit:'Relaxed',image:'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?fm=webp&fit=crop&w=800&q=72',tag:'Bestseller'},
{id:'p2',name:'Noor Embroidered Kurta',category:'Kurtas & sets',price:195,oldPrice:0,colour:'Ivory',fabric:'Cotton',occasion:'Everyday',fit:'Regular',image:'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?fm=webp&fit=crop&w=800&q=72',tag:'New arrival'},
{id:'p3',name:'Saanjh Chanderi Anarkali',category:'Occasion wear',price:320,oldPrice:390,colour:'Rose',fabric:'Chanderi',occasion:'Wedding',fit:'Flared',image:'https://images.unsplash.com/photo-1595777457583-95e059d581b8?fm=webp&fit=crop&w=800&q=72',tag:'The festive edit'},
{id:'p4',name:'Zoya Everyday Co-ord',category:'Everyday essentials',price:165,oldPrice:0,colour:'Sage',fabric:'Linen blend',occasion:'Everyday',fit:'Relaxed',image:'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?fm=webp&fit=crop&w=800&q=72',tag:'New arrival'},
{id:'p5',name:'Meher Occasion Set',category:'Occasion wear',price:395,oldPrice:450,colour:'Gold',fabric:'Silk blend',occasion:'Eid',fit:'Regular',image:'https://images.unsplash.com/photo-1595777457583-95e059d581b8?fm=webp&fit=crop&w=800&q=72',tag:'Limited edition'},
{id:'p6',name:'The Everyday Cotton Kurta',category:'Kurtas & sets',price:125,oldPrice:0,colour:'Blue',fabric:'Cotton',occasion:'Everyday',fit:'Relaxed',image:'https://images.unsplash.com/photo-1483985988355-763728e1935b?fm=webp&fit=crop&w=800&q=72',tag:'Everyday favourite'},
{id:'p7',name:'Onam Kasavu Salwar Set',category:'Salwar suits',price:245,oldPrice:0,colour:'Ivory',fabric:'Cotton',occasion:'Onam',fit:'Regular',image:'https://images.unsplash.com/photo-1483985988355-763728e1935b?fm=webp&fit=crop&w=800&q=72',tag:'Heritage edit'},
{id:'p8',name:'Aaira Evening Ensemble',category:'Occasion wear',price:425,oldPrice:0,colour:'Black',fabric:'Georgette',occasion:'Eid',fit:'Regular',image:'https://images.unsplash.com/photo-1595777457583-95e059d581b8?fm=webp&fit=crop&w=800&q=72',tag:'After dark'}
];
// Privacy policy shown at /privacy (Markdown-style, rendered by app/policy-text.tsx).
// Structure follows the store's supplied policy; each section describes what this site
// actually does. Saved settings without this version show this text until the settings
// are next saved in the admin; after that the admin's own edits are kept.
export const PRIVACY_POLICY_VERSION=1;
export const PRIVACY_POLICY = `## Who we are

Our website address is: https://4lfashion.com.qa. 4L Fashion is a clothing store in Doha, Qatar. When we say "we" or "us" in this policy, we mean 4L Fashion.

## What we collect

- **Orders:** your name, email address, phone number, delivery address, the items you buy and any notes you add (such as measurements or a gift message). We use these to process, deliver and support your order.
- **Your account:** if you sign in with Google, we receive your name and email address from Google. We do not receive your Google password.
- **Returns and exchanges:** the details you give us when you request a return or size exchange.
- **Updates:** your email address if you sign up for our newsletter or a back-in-stock alert.

## Comments and reviews

If you are signed in and leave a review, we store the review together with your account details. Reviews are seen by our team and are not published automatically. We do not use Gravatar or any other profile-picture service.

## Media

Product photos on this website are uploaded by our team. Customers cannot upload images to the website.

## Cookies

- When you sign in, we set one secure cookie that keeps you signed in for up to 7 days. It is removed when you sign out.
- While you are signing in with Google, a temporary cookie is used to protect the sign-in. It expires after 10 minutes.
- Your shopping bag and wishlist are saved in your browser's local storage on your own device, so they are still there when you come back. They are not sent to us until you place an order.

We do not use advertising or tracking cookies.

## Embedded content from other websites

Some pages use content from other services, such as fonts from Google Fonts and some images from Unsplash. When your browser loads this content, those services can see your IP address and browser details, as if you had visited their website.

## Who we share your data with

We only share your data with the services we need to run the store:

- **Cloudflare**, which hosts this website and stores its data.
- **Google**, if you choose to sign in with Google.
- **Resend**, which sends our order and account emails.
- **WhatsApp (Meta)**, if we send you order updates on WhatsApp.
- **Delivery partners**, who receive your name, phone number and address to deliver your order.

We do not sell your personal data.

## How long we retain your data

We keep order records for as long as we need them for delivery, returns, accounting and our legal obligations. Account, review and subscription details are kept until you ask us to delete them or unsubscribe.

## What rights you have over your data

You can ask us for a copy of the personal data we hold about you, ask us to correct it, or ask us to delete it. This does not include data we are obliged to keep for administrative, legal, or security purposes. To make a request, contact us through the Contact page or on WhatsApp.

## Where your data is sent

Your data is processed by the services listed above, which may store it on servers outside Qatar. We only share what each service needs to do its job.`;
export function withCurrentPolicies<T extends Record<string,any>>(settings:T):T{if(Number(settings?.privacyPolicyVersion)>=PRIVACY_POLICY_VERSION)return settings;return {...settings,privacyPolicyVersion:PRIVACY_POLICY_VERSION,policies:{...(settings?.policies||{}),Privacy:PRIVACY_POLICY}};}
export const initialSettings={privacyPolicyVersion:PRIVACY_POLICY_VERSION,name:'4L Fashion',currency:'QAR',announcement:'',heroTitle:'For every version of you.',heroSubtitle:'Thoughtfully chosen. Beautifully worn. Discover a wardrobe that feels like you.',shipping:10,freeShipping:0,coupon:'WELCOME10',couponPercent:10,whatsapp:'97431480006',email:'info@4LFashion.com.qa',address:'Al Mana Building, Building 70, Zone 26, Street 310, Old Airport Street, Doha, Qatar',headerLocation:"Doha, Qatar",navSaleLabel:"The sale edit",heroEyebrow:"ROOTED IN TRADITION. STYLED FOR TODAY.",heroButton:"Explore the new collection",heroNote:"THE NEW SEASON EDIT — 2026",benefits:"Quick delivery across Qatar\nPersonal support for size exchanges\nThoughtfully curated, always",newsletterEyebrow:"A LITTLE SOMETHING, JUST FOR YOU",newsletterTitle:"Good style. Better company.",newsletterText:"New collections, styling notes and lovely little surprises. In your inbox.",footerTagline:"Everyday elegance.\nExtraordinary you.",footerLocation:"DOHA, QATAR",footerContactTitle:"Come say hello",footerAddress:"Al Mana Building · No. 70\nZone 26 · Street 310\nOld Airport Street, Doha, Qatar",footerPhones:"+974 3148 0006\n+974 3148 0005",footerCopyright:"Wear your story.",footerBottomNote:"Qatar · QAR",sizeChart:[{size:'M',bust:36,waist:30,hip:40},{size:'L',bust:38,waist:32,hip:42},{size:'XL',bust:40,waist:34,hip:44},{size:'XXL',bust:42,waist:36,hip:46},{size:'3XL',bust:44,waist:38,hip:48},{size:'4XL',bust:46,waist:40,hip:50},{size:'5XL',bust:48,waist:42,hip:52}],policies:{Shipping:'Qatar delivery rates and timelines are confirmed at checkout. International delivery is available by enquiry. Contact our Doha team for assistance.',Returns:'Please contact our team with your order number to request a return or size exchange. Items must be unworn with tags attached. Final eligibility and timelines are confirmed by the store.',Privacy:PRIVACY_POLICY,Terms:'Product availability is subject to stock confirmation. Orders placed with cash on delivery are subject to store confirmation. Contact the store for assistance.'}};
