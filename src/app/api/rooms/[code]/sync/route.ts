import { authPlayer, getRoom, readJson, sweep } from '@/game/server/rooms';
import type { ClientUpdate } from '@/game/shared/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const room = getRoom(code);
  if (!room) return Response.json({ error: 'Комната закрыта' }, { status: 404 });
  const body = await readJson(req);
  const p = authPlayer(room, body);
  if (!p) return Response.json({ error: 'Вы больше не в этой комнате' }, { status: 403 });
  const now = Date.now();
  if (body.upd && typeof body.upd === 'object') room.applyUpdate(p.id, body.upd as ClientUpdate, now);
  else p.lastSeen = now;
  room.advance(now);
  sweep(now);
  const since = Number(body.since);
  return Response.json(room.snapshot(p.id, Number.isFinite(since) ? since : 0, now));
}
