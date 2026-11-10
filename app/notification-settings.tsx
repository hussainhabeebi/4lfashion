"use client";
import {useState} from 'react';
import {CheckCircle2, Mail, MessageCircle, Send} from 'lucide-react';
import {NOTIFY_EVENTS, type NotifyEvent} from '../lib/orders';
import {DEFAULT_NOTIFY, type NotifySettings} from '../lib/notify';

// Admin > Settings > Notifications: which order messages go out on which channel,
// new-order alerts for the store, and how to switch on automatic sending.
export default function NotificationSettings({settings, config, busy, onSave, onTest}: {
  settings: Record<string, unknown>; config?: {email: boolean; whatsapp: boolean; whatsappTemplate?: boolean}; busy: boolean;
  onSave: (changes: Record<string, unknown>) => Promise<unknown>; onTest: (channel: 'email' | 'whatsapp', to: string) => Promise<unknown>;
}) {
  const saved = (settings.notifications || {}) as NotifySettings;
  const [email, setEmail] = useState<Record<string, boolean>>({...DEFAULT_NOTIFY.email, ...(saved.email || {})});
  const [wa, setWa] = useState<Record<string, boolean>>({...DEFAULT_NOTIFY.whatsapp, ...(saved.whatsapp || {})});
  const [storeAlerts, setStoreAlerts] = useState(saved.storeAlerts ?? true);
  const [storeEmail, setStoreEmail] = useState(saved.storeEmail || String(settings.email || ''));
  const [testTo, setTestTo] = useState({email: String(settings.email || ''), whatsapp: String(settings.whatsapp || '')});

  const status = (on: boolean | undefined) => on ? <span className="badge green"><CheckCircle2 size={11}/> Automatic</span> : <span className="badge">Manual only</span>;
  return <form className="notification-settings" onSubmit={async e => { e.preventDefault(); try { await onSave({notifications: {email, whatsapp: wa, storeAlerts, storeEmail: storeEmail.trim()}}); } catch {} }}>
    <section className="panel">
      <h3>Customer messages</h3>
      <p className="muted">Choose which order updates are sent automatically. Staff can also send any message by hand from an order.</p>
      <div className="table-scroll"><table className="notify-table"><thead><tr><th>Message</th><th><Mail size={13}/> Email {status(config?.email)}</th><th><MessageCircle size={13}/> WhatsApp {status(config?.whatsapp)}</th></tr></thead>
        <tbody>{NOTIFY_EVENTS.map(({key, label}) => <tr key={key}><td>{label}</td>
          <td><input type="checkbox" aria-label={label + ' email'} checked={!!email[key as NotifyEvent]} onChange={e => setEmail({...email, [key]: e.target.checked})}/></td>
          <td><input type="checkbox" aria-label={label + ' WhatsApp'} checked={!!wa[key as NotifyEvent]} onChange={e => setWa({...wa, [key]: e.target.checked})}/></td></tr>)}</tbody></table></div>
    </section>
    <section className="panel">
      <h3>Store alerts</h3>
      <label className="check"><input type="checkbox" checked={storeAlerts} onChange={e => setStoreAlerts(e.target.checked)}/> Email the store about new orders and customer cancellations</label>
      <label>Send store alerts to<input type="email" value={storeEmail} onChange={e => setStoreEmail(e.target.value)} placeholder="orders@yourstore.com"/></label>
    </section>
    <button className="primary" disabled={busy}>Save notification settings</button>

    <section className="panel setup">
      <h3>Switch on automatic sending</h3>
      <p>Until these are set, nothing is sent automatically. Orders still work, and each order page has buttons that open WhatsApp or your email app with the message ready to send.</p>
      <p>Add these as <b>secrets</b> in Cloudflare → Workers &amp; Pages → your 4L Fashion worker → Settings → Variables and Secrets, then redeploy:</p>
      <h4><Mail size={14}/> Email (Resend) {status(config?.email)}</h4>
      <ul><li><code>RESEND_API_KEY</code> – from resend.com → API keys</li><li><code>EMAIL_FROM</code> – e.g. <code>4L Fashion &lt;orders@4lfashion.com.qa&gt;</code> (verify the domain in Resend first)</li></ul>
      <h4><MessageCircle size={14}/> WhatsApp (WhatsApp Business Cloud API) {status(config?.whatsapp)}</h4>
      <ul><li><code>WHATSAPP_TOKEN</code> – a permanent access token from Meta Business</li><li><code>WHATSAPP_PHONE_NUMBER_ID</code> – the ID of your WhatsApp business number</li>
        <li><code>WHATSAPP_TEMPLATE</code> – name of an approved message template whose body has 3 variables: customer name, order number, message {config?.whatsapp && !config.whatsappTemplate && <b>· not set: messages only reach customers who wrote to you in the last 24 hours</b>}</li>
        <li><code>WHATSAPP_TEMPLATE_LANG</code> – optional template language code, default <code>en</code></li></ul>
      <div className="test-row">
        <label>Test email to<input type="email" value={testTo.email} onChange={e => setTestTo({...testTo, email: e.target.value})}/></label>
        <button type="button" className="outline" disabled={busy || !config?.email} onClick={() => onTest('email', testTo.email)}><Send size={14}/> Send test</button>
      </div>
      <div className="test-row">
        <label>Test WhatsApp to<input value={testTo.whatsapp} onChange={e => setTestTo({...testTo, whatsapp: e.target.value})} placeholder="+974…"/></label>
        <button type="button" className="outline" disabled={busy || !config?.whatsapp} onClick={() => onTest('whatsapp', testTo.whatsapp)}><Send size={14}/> Send test</button>
      </div>
    </section>
  </form>;
}
