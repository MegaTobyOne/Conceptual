/**
 * Posture store: single-row table keyed by POSTURE_KEY.
 */

import type { PspfDb } from './db.ts';
import { POSTURE_KEY } from './db.ts';
import type { PostureRecord } from './types.ts';

export async function getPosture(db: PspfDb): Promise<PostureRecord | undefined> {
  return db.get('posture', POSTURE_KEY);
}

export async function putPosture(db: PspfDb, value: PostureRecord): Promise<void> {
  await db.put('posture', { ...value, id: POSTURE_KEY });
}
