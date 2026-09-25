import { authPlayer, getRoom, readJson } from '@/game/server/rooms';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const room = getRoom(code);
  if (!room) return Response.json({ error: 'Комната закрыта' }, { status: 404 });
  const body = await readJson(req);
  const p = authPlayer(room, body);
  if (!p) return Response.json({ error: 'Нет доступа' }, { status: 403 });
  const isHost = room.hostId === p.id;
  const action = String(body.action ?? '');
  const now = Date.now();
  if (action === 'start') {
    if (!isHost) return Response.json({ error: 'Начать матч может только хост' }, { status: 403 });
    if (room.state === 'lobby' || room.state === 'over') room.start(now);
  } else if (action === 'restart') {
    if (room.state !== 'over' && !isHost) return Response.json({ error: 'Перезапуск доступен хосту' }, { status: 403 });
    room.start(now);
  } else if (action === 'lobby') {
    if (!isHost) return Response.json({ error: 'Только хост' }, { status: 403 });
    room.toLobby();
  } else if (action === 'settings') {
    if (!isHost) return Response.json({ error: 'Настройки меняет только хост' }, { status: 403 });
    if (room.state !== 'lobby' && room.state !== 'over') return Response.json({ error: 'Матч уже идёт' }, { status: 409 });
    room.applySettings(body.settings);
  } else {
    return Response.json({ error: 'Неизвестное действие' }, { status: 400 });
  }
  return Response.json({ ok: true });
}
