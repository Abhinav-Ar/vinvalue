import { and, desc, eq, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { alerts, vehicles } from '@/lib/db/schema';
import type { AlertType } from '@/lib/contracts';
import { notificationsConfig as cfg } from '@/config/notifications';
import { badgesFor } from '@/lib/garage/labels';
import { badRequest, notFound } from '@/lib/errors';
import { ALERT_TYPES } from '@/config/notifications';
import { loadNotifyContext } from './prefs';

export type AlertFilter = 'all' | 'unread' | AlertType;
export type AlertItem = {
  id: string;
  type: AlertType;
  vehicle: { id: string; label: string; badge: string } | null;
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
  read: boolean;
};

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}
function decodeCursor(c: string): { at: Date; id: string } {
  const raw = Buffer.from(c, 'base64url').toString('utf8');
  const i = raw.indexOf('|');
  const at = new Date(raw.slice(0, i));
  if (i < 0 || Number.isNaN(at.getTime())) throw badRequest('Invalid cursor.', { cursor: ['Invalid cursor.'] });
  return { at, id: raw.slice(i + 1) };
}

export async function listAlerts(db: Db, userId: string, filter: AlertFilter, cursor?: string) {
  // Types the user switched off for in-app are hidden from the list and the unread count
  // (rows are still created so other channels and dedupe work). Recall in-app is always on.
  const ctx = await loadNotifyContext(db, userId);
  const visible = ALERT_TYPES.filter((t) => t === 'recall' || (ctx?.matrix[t].in_app ?? true));
  const base = and(eq(alerts.userId, userId), inArray(alerts.type, visible))!;
  const conds: SQL[] = [base];
  if (filter === 'unread') conds.push(isNull(alerts.readAt));
  else if (filter !== 'all') conds.push(eq(alerts.type, filter));
  if (cursor) {
    const c = decodeCursor(cursor);
    conds.push(or(lt(alerts.createdAt, c.at), and(eq(alerts.createdAt, c.at), lt(alerts.id, c.id)))!);
  }
  const rows = await db
    .select()
    .from(alerts)
    .where(and(...conds))
    .orderBy(desc(alerts.createdAt), desc(alerts.id))
    .limit(cfg.alertsPageSize + 1);
  const page = rows.slice(0, cfg.alertsPageSize);
  const next = rows.length > cfg.alertsPageSize ? page[page.length - 1]! : null;

  const [unread] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(alerts)
    .where(and(base, isNull(alerts.readAt)));

  const vs = page.some((a) => a.vehicleId)
    ? await db
        .select({ id: vehicles.id, specs: vehicles.specs, trim: vehicles.trim, nickname: vehicles.nickname, createdAt: vehicles.createdAt })
        .from(vehicles)
        .where(eq(vehicles.userId, userId))
    : [];
  const badges = badgesFor(vs);

  const items: AlertItem[] = page.map((a) => {
    const b = a.vehicleId ? badges.get(a.vehicleId) : undefined;
    return {
      id: a.id,
      type: a.type,
      vehicle: a.vehicleId && b ? { id: a.vehicleId, label: b.label, badge: b.letter } : null,
      title: a.title,
      body: a.body,
      link: a.link,
      createdAt: a.createdAt.toISOString(),
      read: a.readAt !== null,
    };
  });
  return { items, unreadCount: Number(unread?.n ?? 0), nextCursor: next ? encodeCursor(next.createdAt, next.id) : null };
}

export async function markRead(db: Db, userId: string, id: string, now = new Date()) {
  const [row] = await db
    .update(alerts)
    .set({ readAt: sql`coalesce(${alerts.readAt}, ${now.toISOString()}::timestamptz)` })
    .where(and(eq(alerts.id, id), eq(alerts.userId, userId)))
    .returning({ id: alerts.id });
  if (!row) throw notFound('Alert');
  return { id: row.id, read: true };
}

export async function markAllRead(db: Db, userId: string, now = new Date()) {
  const rows = await db
    .update(alerts)
    .set({ readAt: now })
    .where(and(eq(alerts.userId, userId), isNull(alerts.readAt)))
    .returning({ id: alerts.id });
  return { updated: rows.length };
}
