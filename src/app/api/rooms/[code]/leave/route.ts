import { authPlayer, getRoom, readJson } from '@/game/server/rooms';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const room = getRoom(code);
  if (!room) return Response.json({ ok: true });
  const body = await readJson(req);
  const p = authPlayer(room, body);
  if (p) room.removePlayer(p.id);
  return Response.json({ ok: true });
}
