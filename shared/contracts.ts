/**
 * Cross-module types agreed between workstreams. See docs/agents/CONTRACTS.md.
 * Feature modules return AlertDrafts; only the alerts module persists/delivers them.
 */
import type { alertTypeEnum } from '../models/db/schema';

export type AlertType = (typeof alertTypeEnum.enumValues)[number];

export type AlertDraft = {
  userId: string;
  type: AlertType;
  vehicleId?: string | null;
  title: string;
  body: string;
  /** App-relative link, e.g. /garage/<id>/value */
  link?: string | null;
  /** Required: identical keys for the same user are created only once. */
  dedupeKey: string;
};
