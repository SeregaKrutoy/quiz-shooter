import os from 'os';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const addresses: string[] = [];
  try {
    const nets = os.networkInterfaces();
    for (const list of Object.values(nets)) {
      for (const n of list ?? []) {
        const fam = n.family as unknown;
        if ((fam === 'IPv4' || fam === 4) && !n.internal) addresses.push(n.address);
      }
    }
  } catch {
    // нет доступа к сетевым интерфейсам
  }
  const host = req.headers.get('host') ?? '';
  const m = host.match(/:(\d+)$/);
  const port = m ? m[1] : process.env.PORT || '3000';
  return Response.json({ addresses, host, port });
}
