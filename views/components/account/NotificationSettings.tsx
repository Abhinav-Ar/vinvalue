'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type useApi } from '@/views/components/client/api';
import { ErrorNote, Field, Select, Skeleton } from '@/views/components/ui';

type AlertType = 'recall' | 'maintenance' | 'value' | 'price_target' | 'renewal' | 'market';
type Channel = 'in_app' | 'email' | 'push' | 'sms';
type EmailDigest = 'instant' | 'recalls_instant_rest_weekly' | 'weekly';
export type PrefsView = {
  matrix: Record<AlertType, Record<Channel, boolean>>;
  emailDigest: EmailDigest;
  quietStart: string | null;
  quietEnd: string | null;
  timeZone: string;
  phone: { masked: string; verified: boolean } | null;
};
type PrefsState = ReturnType<typeof useApi<PrefsView>>;

const ROWS: { type: AlertType; label: string }[] = [
  { type: 'recall', label: 'Recalls' },
  { type: 'maintenance', label: 'Maintenance due' },
  { type: 'value', label: 'Value changes' },
  { type: 'price_target', label: 'Price targets' },
  { type: 'renewal', label: 'Registration and insurance' },
  { type: 'market', label: 'Market moves' },
];
const COLS: { ch: Channel; label: string }[] = [
  { ch: 'in_app', label: 'In-app' },
  { ch: 'email', label: 'Email' },
  { ch: 'push', label: 'Push' },
  { ch: 'sms', label: 'SMS' },
];
const DIGEST: { value: EmailDigest; label: string }[] = [
  { value: 'recalls_instant_rest_weekly', label: 'Instant for recalls, weekly digest for the rest' },
  { value: 'instant', label: 'Everything instantly' },
  { value: 'weekly', label: 'Weekly digest only' },
];

/** Shown next to the consent box and sent verbatim to POST /api/phone/send-code. Keep them identical. */
export const SMS_CONSENT_TEXT =
  'I agree to receive alert texts from AutoIQ at this number, including a one-time verification code. Message frequency varies. Message and data rates may apply. I can remove my number on this page at any time.';

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export function NotificationSettings({ prefs, onInAppChanged }: { prefs: PrefsState; onInAppChanged: () => void }) {
  const { data, error, reload, setData } = prefs;
  const [saving, setSaving] = useState<string | null>(null);
  const [pushOk, setPushOk] = useState(true);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  if (error) {
    if (error.status === 401) return <div />;
    return <ErrorNote error={error} onRetry={reload} />;
  }
  if (!data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} aria-busy="true">
        <Skeleton h={340} />
        <Skeleton h={420} />
      </div>
    );
  }

  const verified = !!data.phone?.verified;

  async function toggle(type: AlertType, ch: Channel, value: boolean) {
    if (!data) return;
    const key = `${type}.${ch}`;
    setSaving(key);
    setMatrixError(null);
    const before = data;
    setData({ ...data, matrix: { ...data.matrix, [type]: { ...data.matrix[type], [ch]: value } } });
    try {
      const next = await api<PrefsView>('/api/notification-prefs', { method: 'PUT', body: { matrix: { [type]: { [ch]: value } } } });
      setData(next);
      if (ch === 'in_app') onInAppChanged();
    } catch (e) {
      setData(before);
      setMatrixError(errMsg(e, 'Could not save that setting. Try again.'));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="sheet" style={{ padding: 22 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Notification settings</h2>
        <div className="scroll-x" tabIndex={0} role="region" aria-label="Notification channels table">
          <table className="tbl" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th scope="col">Alert</th>
                {COLS.map((c) => (
                  <th key={c.ch} scope="col" style={{ textAlign: 'center' }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.type}>
                  <th scope="row" style={{ fontWeight: 400, fontSize: 14, color: 'var(--ink)', borderBottom: '1px solid var(--line)', padding: 12 }}>
                    {r.label}
                  </th>
                  {COLS.map((c) => {
                    const lockedOn = r.type === 'recall' && c.ch === 'in_app';
                    const smsOff = c.ch === 'sms' && !verified;
                    const pushOff = c.ch === 'push' && !pushOk;
                    const checked = lockedOn ? true : data.matrix[r.type][c.ch];
                    const describedBy = lockedOn ? 'note-recall' : c.ch === 'sms' ? 'note-sms' : pushOff ? 'note-push' : undefined;
                    return (
                      <td key={c.ch} style={{ textAlign: 'center', padding: 0 }}>
                        <label style={{ display: 'inline-flex', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', cursor: lockedOn || smsOff || pushOff ? 'not-allowed' : 'pointer' }}>
                          <input
                            type="checkbox"
                            aria-label={`${r.label} by ${c.label}`}
                            aria-describedby={describedBy}
                            checked={checked}
                            disabled={lockedOn || smsOff || pushOff || saving === `${r.type}.${c.ch}`}
                            onChange={(e) => toggle(r.type, c.ch, e.target.checked)}
                            style={{ width: 20, height: 20, accentColor: 'var(--blue)', margin: 0 }}
                          />
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {matrixError && (
          <p className="err" role="alert" style={{ marginTop: 12 }}>
            {matrixError}
          </p>
        )}
        <p id="note-sms" className="small" style={{ margin: '12px 0 0', lineHeight: 1.5 }}>
          {verified
            ? `SMS goes to ${data.phone!.masked}.`
            : 'SMS needs a verified mobile number. Verify one under Delivery to change these boxes; ticked SMS alerts start sending once the number is verified.'}
        </p>
        {!pushOk && (
          <p id="note-push" className="small" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
            Push is not available here. Delivery below explains why.
          </p>
        )}
        <p id="note-recall" className="small" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
          In-app recall alerts are always on.
        </p>
      </div>

      <div className="sheet" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Delivery</h2>
        <DigestField prefs={data} onSaved={setData} />
        <PhoneSection prefs={data} onChanged={reload} />
        <QuietHours prefs={data} onSaved={setData} />
        <PushSection onAvailable={setPushOk} />
      </div>
    </div>
  );
}

function DigestField({ prefs, onSaved }: { prefs: PrefsView; onSaved: (p: PrefsView) => void }) {
  const [err, setErr] = useState<string[] | undefined>();
  const [busy, setBusy] = useState(false);
  return (
    <Field label="Email" errors={err}>
      {({ id, describedBy, invalid }) => (
        <Select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          value={prefs.emailDigest}
          options={DIGEST}
          onChange={async (v) => {
            if (busy) return;
            setBusy(true);
            setErr(undefined);
            try {
              onSaved(await api<PrefsView>('/api/notification-prefs', { method: 'PUT', body: { emailDigest: v } }));
            } catch (e) {
              setErr([errMsg(e, 'Could not save the email setting. Try again.')]);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </Field>
  );
}

function PhoneSection({ prefs, onChanged }: { prefs: PrefsView; onChanged: () => void }) {
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState<{ masked: string; expiresAt: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldErr, setFieldErr] = useState<Record<string, string[]>>({});
  const [msg, setMsg] = useState<string | null>(null);

  function fail(e: unknown, fallback: string) {
    if (e instanceof ApiError && Object.keys(e.fields).length) setFieldErr(e.fields);
    setMsg(errMsg(e, fallback));
  }

  async function sendCode() {
    setFieldErr({});
    setMsg(null);
    if (!consent) {
      setFieldErr({ consent: ['Tick the box to agree to texts before we send a code.'] });
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ phone: { masked: string }; expiresAt: string }>('/api/phone/send-code', {
        method: 'POST',
        body: { phone, consent: true, consentText: SMS_CONSENT_TEXT },
      });
      setSent({ masked: r.phone.masked, expiresAt: r.expiresAt });
      setCode('');
    } catch (e) {
      fail(e, 'Could not send a code. Check the number and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setFieldErr({});
    setMsg(null);
    setBusy(true);
    try {
      await api('/api/phone/verify', { method: 'POST', body: { code } });
      setSent(null);
      setPhone('');
      setConsent(false);
      onChanged();
    } catch (e) {
      fail(e, 'Could not check the code. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setMsg(null);
    setBusy(true);
    try {
      await api('/api/phone', { method: 'DELETE' });
      onChanged();
    } catch (e) {
      fail(e, 'Could not remove the number. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (prefs.phone?.verified) {
    return (
      <div className="field">
        <span style={{ fontSize: 15 }}>Mobile number for SMS</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="mono">{prefs.phone.masked}</span>
          <span className="small">Verified</span>
          <button type="button" className="btn-o" onClick={remove} disabled={busy}>
            Remove number
          </button>
        </div>
        <p className="small" style={{ margin: 0 }}>Removing the number stops all texts.</p>
        {msg && <p className="err" role="alert">{msg}</p>}
      </div>
    );
  }

  if (sent) {
    const exp = new Date(sent.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field
          label="Verification code"
          hint={`We texted a 6-digit code to ${sent.masked}. It works until ${exp}.`}
          errors={fieldErr.code ?? (msg ? [msg] : undefined)}
        >
          {({ id, describedBy, invalid }) => (
            <div style={{ display: 'flex' }}>
              <input
                id={id}
                className="inp mono"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                style={{ borderRight: 0 }}
              />
              <button type="button" className="btn" onClick={verify} disabled={busy || code.length !== 6}>
                Verify
              </button>
            </div>
          )}
        </Field>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="ghost" onClick={sendCode} disabled={busy}>
            Send a new code
          </button>
          <button type="button" className="ghost" onClick={() => { setSent(null); setMsg(null); setFieldErr({}); }} disabled={busy}>
            Use a different number
          </button>
        </div>
      </div>
    );
  }

  const otherMsg = msg && !fieldErr.phone && !fieldErr.consent ? msg : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Field label="Mobile number for SMS" hint="US numbers only." errors={fieldErr.phone}>
        {({ id, describedBy, invalid }) => (
          <div style={{ display: 'flex' }}>
            <input
              id={id}
              className="inp mono"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(555) 555-0123"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              style={{ borderRight: 0 }}
            />
            <button type="button" className="btn" onClick={sendCode} disabled={busy || phone.trim().length < 7}>
              Send code
            </button>
          </div>
        )}
      </Field>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          aria-invalid={!!fieldErr.consent}
          style={{ width: 20, height: 20, accentColor: 'var(--blue)', margin: '2px 0 0', flex: '0 0 auto' }}
        />
        <span className="small" style={{ lineHeight: 1.5 }}>{SMS_CONSENT_TEXT}</span>
      </label>
      {fieldErr.consent && <p className="err" role="alert">{fieldErr.consent[0]}</p>}
      {otherMsg && <p className="err" role="alert">{otherMsg}</p>}
    </div>
  );
}

function QuietHours({ prefs, onSaved }: { prefs: PrefsView; onSaved: (p: PrefsView) => void }) {
  const [start, setStart] = useState(prefs.quietStart ?? '');
  const [end, setEnd] = useState(prefs.quietEnd ?? '');
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [device, setDevice] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDevice(Intl.DateTimeFormat().resolvedOptions().timeZone || null);
    } catch {
      setDevice(null);
    }
  }, []);

  const dirty = (start || null) !== prefs.quietStart || (end || null) !== prefs.quietEnd;

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setFields({});
    setMsg(null);
    try {
      const next = await api<PrefsView>('/api/notification-prefs', { method: 'PUT', body });
      onSaved(next);
      setStart(next.quietStart ?? '');
      setEnd(next.quietEnd ?? '');
      setMsg('Saved.');
    } catch (e) {
      if (e instanceof ApiError) setFields(e.fields);
      setMsg(errMsg(e, 'Could not save quiet hours. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  const failed = msg && msg !== 'Saved.';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="g2" style={{ gap: 12 }}>
        <Field label="Quiet from" errors={fields.quietStart}>
          {({ id, describedBy, invalid }) => (
            <input id={id} type="time" className="inp mono" value={start} onChange={(e) => setStart(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
          )}
        </Field>
        <Field label="Until" errors={fields.quietEnd}>
          {({ id, describedBy, invalid }) => (
            <input id={id} type="time" className="inp mono" value={end} onChange={(e) => setEnd(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
          )}
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn-o" disabled={busy || !dirty} onClick={() => save({ quietStart: start || null, quietEnd: end || null })}>
          Save quiet hours
        </button>
        {(prefs.quietStart || prefs.quietEnd) && (
          <button type="button" className="ghost" disabled={busy} onClick={() => save({ quietStart: null, quietEnd: null })}>
            Turn off quiet hours
          </button>
        )}
      </div>
      <p className="small" style={{ margin: 0 }}>Recall alerts ignore quiet hours.</p>
      <p className="small" style={{ margin: 0 }}>
        Times use the {prefs.timeZone} time zone.
        {device && device !== prefs.timeZone && (
          <>
            {' '}
            <button type="button" className="ghost" disabled={busy} onClick={() => save({ timeZone: device })} style={{ marginTop: 8 }}>
              Use {device} instead
            </button>
          </>
        )}
      </p>
      {msg && (
        <p className={failed ? 'err' : 'small'} role={failed ? 'alert' : 'status'} style={failed ? undefined : { margin: 0 }}>
          {msg}
        </p>
      )}
    </div>
  );
}

type PushState =
  | { s: 'checking' }
  | { s: 'unsupported' }
  | { s: 'not_configured' }
  | { s: 'unavailable'; message: string }
  | { s: 'denied' }
  | { s: 'off'; key: string }
  | { s: 'on'; endpoint: string };

function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function PushSection({ onAvailable }: { onAvailable: (ok: boolean) => void }) {
  const [st, setSt] = useState<PushState>({ s: 'checking' });

  useEffect(() => {
    onAvailable(!(st.s === 'unsupported' || st.s === 'not_configured' || st.s === 'unavailable'));
  }, [st.s, onAvailable]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        if (live) setSt({ s: 'unsupported' });
        return;
      }
      let key: string;
      try {
        key = (await api<{ publicKey: string }>('/api/push-subscriptions/vapid-key')).publicKey;
      } catch (e) {
        if (!live) return;
        if (e instanceof ApiError && e.code === 'not_configured') setSt({ s: 'not_configured' });
        else setSt({ s: 'unavailable', message: errMsg(e, 'Could not check push notifications.') });
        return;
      }
      if (Notification.permission === 'denied') {
        if (live) setSt({ s: 'denied' });
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration('/');
        const sub = await reg?.pushManager.getSubscription();
        if (live) setSt(sub ? { s: 'on', endpoint: sub.endpoint } : { s: 'off', key });
      } catch {
        if (live) setSt({ s: 'off', key });
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  async function turnOn(key: string) {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setSt(perm === 'denied' ? { s: 'denied' } : { s: 'off', key });
        if (perm !== 'denied') setMsg('Allow notifications when your browser asks to turn on push.');
        return;
      }
      await navigator.serviceWorker.register('/sw.js');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      await api('/api/push-subscriptions', { method: 'POST', body: sub.toJSON() });
      setSt({ s: 'on', endpoint: sub.endpoint });
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Push could not start in this browser. Try again, or use email or SMS instead.');
    } finally {
      setBusy(false);
    }
  }

  async function turnOff(endpoint: string) {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe();
      await api('/api/push-subscriptions', { method: 'DELETE', body: { endpoint } });
      const key = (await api<{ publicKey: string }>('/api/push-subscriptions/vapid-key')).publicKey;
      setSt({ s: 'off', key });
    } catch (e) {
      setMsg(errMsg(e, 'Could not turn off push. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  let body: ReactNode;
  switch (st.s) {
    case 'checking':
      body = <Skeleton w="80%" h={16} />;
      break;
    case 'unsupported':
      body = <p className="small" style={{ margin: 0 }}>This browser does not support push notifications. Use email or SMS, or open AutoIQ in a browser that supports push.</p>;
      break;
    case 'not_configured':
      body = <p className="small" style={{ margin: 0 }}>Push notifications are not available yet because they are not set up on our server. Use email or SMS for now.</p>;
      break;
    case 'unavailable':
      body = <p className="small" style={{ margin: 0 }}>{st.message} Use email or SMS for now.</p>;
      break;
    case 'denied':
      body = <p className="small" style={{ margin: 0 }}>Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then reload this page.</p>;
      break;
    case 'off':
      body = (
        <>
          <p className="small" style={{ margin: 0 }}>Push is off in this browser.</p>
          <button type="button" className="btn-o" onClick={() => turnOn(st.key)} disabled={busy}>
            Turn on push in this browser
          </button>
        </>
      );
      break;
    case 'on':
      body = (
        <>
          <p className="small" style={{ margin: 0 }}>Push is on in this browser.</p>
          <button type="button" className="ghost" onClick={() => turnOff(st.endpoint)} disabled={busy}>
            Turn off push in this browser
          </button>
        </>
      );
      break;
  }

  return (
    <div className="field" style={{ alignItems: 'flex-start' }}>
      <span style={{ fontSize: 15 }}>Push notifications</span>
      {body}
      {msg && <p className="err" role="alert">{msg}</p>}
    </div>
  );
}
