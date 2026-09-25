import { db } from '@/db';
import { customExams } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const c = String(code || '').toUpperCase().slice(0, 8);
  if (!/^[A-Z0-9]{4,8}$/.test(c)) return Response.json({ error: 'Некорректный код' }, { status: 400 });
  try {
    const rows = await db.select().from(customExams).where(eq(customExams.code, c)).limit(1);
    const row = rows[0];
    if (!row) return Response.json({ error: 'Экзамен с таким кодом не найден' }, { status: 404 });
    const payload = row.payload as { q?: unknown };
    db.update(customExams)
      .set({ downloads: sql`${customExams.downloads} + 1` })
      .where(eq(customExams.code, c))
      .catch(() => {});
    return Response.json({ code: row.code, title: row.title, author: row.author, questions: (payload as { q: unknown }).q ?? [], downloads: row.downloads });
  } catch {
    return Response.json({ error: 'База данных недоступна' }, { status: 500 });
  }
}
