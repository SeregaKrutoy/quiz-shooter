// Свои экзамены: кодирование для обмена, загрузка на сервер, импорт.
import { ExamPack, sanitizeExamPack } from '../shared/types';
import type { CustomExam } from './storage';

export type QTuple = [string, [string, string, string, string], number, string, string?, number?];

export interface SharePayload {
  t: string;
  a: string;
  q: QTuple[];
}

const toTuple = (q: ExamPack['questions'][number], withImg: boolean): QTuple => {
  const t: QTuple = [q.q, q.options, q.answer, q.note];
  if (withImg && q.img) t[4] = q.img;
  if (q.d) { if (t.length < 5) t[4] = ''; t[5] = q.d; }
  return t;
};
const fromTuple = (r: QTuple) => ({ q: r[0], options: r[1], answer: r[2], note: r[3], img: r[4] || undefined, d: r[5] });

const PREFIX = 'BNR1.';

function toB64url(json: string): string {
  const b64 = btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): string {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Компактный текстовый код экзамена для вставки (работает без сервера). Картинки не включаются — слишком длинно для мессенджера. */
export function encodeExamCode(exam: ExamPack, author: string): string {
  const payload: SharePayload = {
    t: exam.title,
    a: author.slice(0, 32),
    q: exam.questions.map((q) => toTuple(q, false)),
  };
  return PREFIX + toB64url(JSON.stringify(payload));
}

export function examHasImages(exam: ExamPack): boolean {
  return exam.questions.some((q) => !!q.img);
}

export function decodeExamCode(code: string): { pack: ExamPack; author: string } | null {
  try {
    const s = code.trim();
    if (!s.startsWith(PREFIX)) return null;
    const payload = JSON.parse(fromB64url(s.slice(PREFIX.length))) as SharePayload;
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.q)) return null;
    const pack = sanitizeExamPack({
      id: `code${Math.abs(s.length * 31 + payload.q.length * 7) % 100000}`,
      title: payload.t,
      questions: payload.q.map(fromTuple),
    });
    if (!pack) return null;
    return { pack, author: typeof payload.a === 'string' ? payload.a.slice(0, 32) : '' };
  } catch {
    return null;
  }
}

export function examShareUrl(code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/?exam=${encodeURIComponent(code.toUpperCase())}`;
}

/** Извлечь код сервера из текста QR (ссылка, «BNR-XXXXXX» или голый код). */
export function extractServerCode(text: string): string | null {
  const s = text.trim();
  const mUrl = s.match(/[?&]exam=([A-Za-z0-9]{4,8})/);
  if (mUrl) return mUrl[1].toUpperCase();
  const mTag = s.match(/BNR-([A-Za-z0-9]{4,8})/i);
  if (mTag) return mTag[1].toUpperCase();
  if (/^[A-Za-z0-9]{4,8}$/.test(s)) return s.toUpperCase();
  return null;
}

export interface ServerExam {
  code: string;
  title: string;
  author: string;
  questions: SharePayload['q'];
  downloads: number;
}

export async function uploadExam(exam: ExamPack, author: string): Promise<string> {
  const r = await fetch('/api/exams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: exam.title,
      author,
      questions: exam.questions.map((q) => toTuple(q, true)),
    }),
  });
  const j = (await r.json().catch(() => ({}))) as { code?: string; error?: string };
  if (!r.ok || !j.code) throw new Error(j.error || 'Не удалось загрузить экзамен');
  return j.code;
}

export async function fetchExamByCode(code: string): Promise<{ pack: ExamPack; author: string }> {
  const r = await fetch(`/api/exams/${encodeURIComponent(code.trim().toUpperCase())}`, { cache: 'no-store' });
  const j = (await r.json().catch(() => ({}))) as Partial<ServerExam> & { error?: string };
  if (!r.ok) throw new Error(j.error || 'Экзамен не найден. Проверьте код.');
  const pack = sanitizeExamPack({
    id: `srv${(j.code ?? code).toUpperCase()}`,
    title: j.title,
    questions: (j.questions ?? []).map(fromTuple),
  });
  if (!pack) throw new Error('Данные экзамена повреждены');
  return { pack, author: typeof j.author === 'string' ? j.author : '' };
}

export async function fetchRecentExams(): Promise<{ code: string; title: string; author: string; count: number; downloads: number }[]> {
  const r = await fetch('/api/exams', { cache: 'no-store' });
  const j = (await r.json().catch(() => ({}))) as { exams?: { code: string; title: string; author: string; count: number; downloads: number }[] };
  return j.exams ?? [];
}

export function examToFile(exam: CustomExam): string {
  return JSON.stringify({ app: 'bilet-respawn-exam', v: 1, title: exam.title, author: exam.author, questions: exam.questions }, null, 2);
}

export function examFromFile(text: string): { pack: ExamPack; author: string } | null {
  try {
    const j = JSON.parse(text) as { title?: unknown; author?: unknown; questions?: unknown };
    const pack = sanitizeExamPack({ id: `file${Date.now() % 100000}`, title: j.title, questions: j.questions });
    if (!pack) return null;
    return { pack, author: typeof j.author === 'string' ? j.author.slice(0, 32) : '' };
  } catch {
    return null;
  }
}

export function downloadTextFile(name: string, text: string) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Сжать картинку для билета: до 640×480, JPEG. Возвращает data URL. */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, 640 / img.width, 480 / img.height);
      const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      if (!g) {
        reject(new Error('Canvas недоступен'));
        return;
      }
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
      g.drawImage(img, 0, 0, w, h);
      let q = 0.82;
      let out = c.toDataURL('image/jpeg', q);
      while (out.length > 260000 && q > 0.4) {
        q -= 0.12;
        out = c.toDataURL('image/jpeg', q);
      }
      resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось открыть картинку'));
    };
    img.src = url;
  });
}
