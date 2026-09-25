import { authPlayer, getRoom, readJson } from '@/game/server/rooms';

export const dynamic = 'force-dynamic';

// Вопросы своих экзаменов комнаты — отдельно от снимков (могут содержать картинки)
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const room = getRoom(code);
  if (!room) return Response.json({ error: 'Комната закрыта' }, { status: 404 });
  const body = await readJson(req);
  const p = authPlayer(room, body);
  if (!p) return Response.json({ error: 'Нет доступа' }, { status: 403 });
  return Response.json({ ver: room.packsVer, packs: room.settings.packs });
}
