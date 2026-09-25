import { randomBytes, randomUUID } from 'crypto';
import { RoomSim } from '../shared/sim';
import { MatchSettings, RoomSummary } from '../shared/types';

interface Registry {
  rooms: Map<string, RoomSim>;
  lastSweep: number;
}

const g = globalThis as typeof globalThis & { __biletRespawnRegistry?: Registry };
const reg: Registry = g.__biletRespawnRegistry ?? (g.__biletRespawnRegistry = { rooms: new Map(), lastSweep: 0 });

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function sweep(now = Date.now()) {
  if (now - reg.lastSweep < 1500) return;
  reg.lastSweep = now;
  for (const [code, room] of reg.rooms) {
    for (const p of [...room.players.values()]) if (now - p.lastSeen > 10000) room.removePlayer(p.id);
    if (room.players.size === 0) {
      if (!room.emptySince) room.emptySince = now;
      else if (now - room.emptySince > 60000) reg.rooms.delete(code);
    } else room.emptySince = 0;
  }
}

export function createRoom(name: string, settings: MatchSettings, isPublic: boolean): RoomSim | null {
  sweep();
  if (reg.rooms.size >= 60) return null;
  let code = '';
  for (let tries = 0; tries < 50; tries++) {
    code = Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
    if (!reg.rooms.has(code)) break;
  }
  const room = new RoomSim(code, name, settings, isPublic);
  room.emptySince = Date.now();
  reg.rooms.set(code, room);
  return room;
}

export function getRoom(code: string): RoomSim | undefined {
  return reg.rooms.get(String(code || '').toUpperCase());
}

export function listRooms(): RoomSummary[] {
  sweep();
  return [...reg.rooms.values()].filter((r) => r.isPublic && r.players.size > 0).map((r) => r.summary());
}

export function newPlayerIds() {
  return { id: 'p' + randomBytes(5).toString('hex'), secret: randomUUID() };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    const v: unknown = JSON.parse(text);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function authPlayer(room: RoomSim, body: Record<string, unknown>) {
  const p = room.players.get(String(body.id ?? ''));
  if (!p || p.secret !== body.secret) return null;
  return p;
}
