import { db } from '@/db';
import { scores } from '@/db/schema';
import { readJson } from '@/game/server/rooms';
import { LAYOUTS, sanitizeName } from '@/game/shared/types';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await db.select().from(scores).orderBy(desc(scores.score)).limit(25);
    return Response.json({ scores: rows });
  } catch {
    return Response.json({ scores: [], error: 'База данных недоступна' });
  }
}

const int = (v: unknown, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
};

export async function POST(req: Request) {
  const b = await readJson(req);
  const mode = ['pvp', 'coop', 'ffa'].includes(String(b.mode)) ? String(b.mode) : 'coop';
  const layout = (LAYOUTS as string[]).includes(String(b.layout)) ? String(b.layout) : 'arena';
  const row = {
    name: sanitizeName(b.name),
    score: int(b.score, 200000),
    kills: int(b.kills, 5000),
    botKills: int(b.bk, 5000),
    deaths: int(b.deaths, 5000),
    correct: int(b.ok, 5000),
    answered: int(b.qa, 5000),
    mode,
    layout,
    online: b.online === true,
  };
  if (row.score <= 0) return Response.json({ ok: false });
  try {
    await db.insert(scores).values(row);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: 'База данных недоступна' }, { status: 500 });
  }
}
