import { createRoom, listRooms, newPlayerIds, readJson } from '@/game/server/rooms';
import { sanitizeLook, sanitizeName, sanitizeSettings } from '@/game/shared/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ rooms: listRooms() });
}

export async function POST(req: Request) {
  const body = await readJson(req);
  const name = sanitizeName(body.name);
  const look = sanitizeLook(body.look);
  const settings = sanitizeSettings(body.settings);
  const roomName = sanitizeName(body.roomName ?? `Комната ${name}`).slice(0, 24);
  const room = createRoom(roomName, settings, body.isPublic !== false);
  if (!room) return Response.json({ error: 'Слишком много комнат на сервере' }, { status: 503 });
  const ids = newPlayerIds();
  const p = room.addPlayer(ids.id, ids.secret, name, look, Date.now());
  if (!p) return Response.json({ error: 'Не удалось войти' }, { status: 500 });
  return Response.json({ code: room.code, id: ids.id, secret: ids.secret });
}
