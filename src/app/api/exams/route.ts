import { db } from '@/db';
import { customExams } from '@/db/schema';
import { sanitizeExamPack } from '@/game/shared/types';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

type QArr = [unknown, unknown, unknown, unknown, unknown?, unknown?];

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const v: unknown = JSON.parse(await req.text());
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// Последние опубликованные экзамены (без самих вопросов)
export async function GET() {
  try {
    const rows = await db
      .select({ code: customExams.code, title: customExams.title, author: customExams.author, payload: customExams.payload, downloads: customExams.downloads })
      .from(customExams)
      .orderBy(desc(customExams.id))
      .limit(20);
    return Response.json({
      exams: rows.map((r) => ({
        code: r.code,
        title: r.title,
        author: r.author,
        count: Array.isArray((r.payload as { q?: unknown[] })?.q) ? (r.payload as { q: unknown[] }).q.length : 0,
        downloads: r.downloads,
      })),
    });
  } catch {
    return Response.json({ exams: [], error: 'База данных недоступна' });
  }
}

// Опубликовать свой экзамен и получить короткий код
export async function POST(req: Request) {
  const b = await readJson(req);
  const rawQ = Array.isArray(b.questions) ? (b.questions as QArr[]) : [];
  const pack = sanitizeExamPack({
    id: 'tmp',
    title: b.title,
    questions: rawQ.map((r) => ({ q: r?.[0], options: r?.[1], answer: r?.[2], note: r?.[3], img: r?.[4], d: r?.[5] })),
  });
  if (!pack) return Response.json({ error: 'Нужно название и минимум 2 заполненных вопроса' }, { status: 400 });
  const author = typeof b.author === 'string' ? b.author.replace(/[<>\n]/g, '').trim().slice(0, 32) : '';
  const payload = { q: pack.questions.map((q) => [q.q, q.options, q.answer, q.note, q.img ?? '', q.d ?? 2]) };
  try {
    for (let i = 0; i < 12; i++) {
      const code = Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
      try {
        await db.insert(customExams).values({ code, title: pack.title, author, payload });
        return Response.json({ code });
      } catch {
        // код занят — пробуем другой
      }
    }
    return Response.json({ error: 'Не удалось создать код, попробуйте ещё раз' }, { status: 500 });
  } catch {
    return Response.json({ error: 'База данных недоступна' }, { status: 500 });
  }
}
