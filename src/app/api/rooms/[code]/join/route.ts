import { getRoom, newPlayerIds, readJson } from '@/game/server/rooms';
import { sanitizeLook, sanitizeName } from '@/game/shared/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const room = getRoom(code);
  if (!room) return Response.json({ error: 'Комната не найдена. Проверьте код.' }, { status: 404 });
  const body = await readJson(req);
  const ids = newPlayerIds();
  const p = room.addPlayer(ids.id, ids.secret, sanitizeName(body.name), sanitizeLook(body.look), Date.now());
  if (!p) return Response.json({ error: 'Комната заполнена (максимум 8 игроков)' }, { status: 409 });
  return Response.json({ code: room.code, id: ids.id, secret: ids.secret });
}
