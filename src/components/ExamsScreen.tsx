'use client';

import { useState } from 'react';
import QrCode from './QrCode';
import QrScanner from './QrScanner';
import { Modal, ScreenShell, Section, Seg } from './ui';
import { sfx } from '@/game/client/audio';
import {
  compressImage, decodeExamCode, downloadTextFile, encodeExamCode, examFromFile, examHasImages, examShareUrl, examToFile,
  extractServerCode, fetchExamByCode, fetchRecentExams, uploadExam,
} from '@/game/client/exams';
import { deleteCustomExam, loadCustomExams, loadProfile, newExamId, saveCustomExam, type CustomExam } from '@/game/client/storage';
import { EXAM_DIFF_INFO, type CustomQuestion, type ExamDiff } from '@/game/shared/types';

type Tab = 'list' | 'edit' | 'import';

interface Draft {
  id: string;
  title: string;
  author: string;
  questions: (CustomQuestion & { open: boolean })[];
}

const blankQ = (): CustomQuestion & { open: boolean } => ({ q: '', options: ['', '', '', ''], answer: 0, note: '', d: 2, open: true });

function toDraft(e?: CustomExam): Draft {
  if (!e) return { id: newExamId(), title: '', author: loadProfile().name, questions: [blankQ(), blankQ()] };
  return { id: e.id, title: e.title, author: e.author, questions: e.questions.map((q) => ({ ...q, options: [...q.options] as [string, string, string, string], open: false })) };
}

function validQ(q: CustomQuestion): boolean {
  return (!!q.q.trim() || !!q.img) && q.options.every((o) => o.trim().length > 0);
}

async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

export default function ExamsScreen({ embedded = false, onBack }: { embedded?: boolean; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('list');
  const [exams, setExams] = useState<CustomExam[]>(() => loadCustomExams());
  const [draft, setDraft] = useState<Draft>(() => toDraft());
  const [share, setShare] = useState<CustomExam | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  const refresh = () => setExams(loadCustomExams());
  const flash = (t: string, ok = true) => {
    setMsg({ t, ok });
    window.setTimeout(() => setMsg(null), 3500);
  };

  const saveDraft = () => {
    const title = draft.title.trim();
    const good = draft.questions.filter(validQ);
    if (title.length < 2) {
      flash('Придумайте название экзамена', false);
      return;
    }
    if (good.length < 2) {
      flash('Нужно минимум 2 заполненных вопроса (текст + 4 варианта)', false);
      return;
    }
    saveCustomExam({
      id: draft.id,
      title: title.slice(0, 60),
      questions: good.map((q) => {
        const out: CustomQuestion = { q: q.q.trim() || 'Что изображено на картинке?', options: q.options.map((o) => o.trim()) as [string, string, string, string], answer: q.answer, note: q.note.trim(), d: q.d ?? 2 };
        if (q.img) out.img = q.img;
        return out;
      }),
      author: draft.author.slice(0, 32),
      updatedAt: Date.now(),
      origin: 'local',
    });
    sfx.correct();
    refresh();
    setTab('list');
    flash(`Экзамен «${title}» сохранён: ${good.length} вопр.`);
  };

  const content = (
    <div className={embedded ? '' : ''}>
      <div className="mb-4 flex max-w-xl flex-wrap gap-2">
        <Seg
          value={tab}
          onChange={(v: Tab) => {
            if (v === 'edit') setDraft(toDraft());
            setTab(v);
          }}
          options={[
            { value: 'list', label: `📚 Мои экзамены (${exams.length})` },
            { value: 'edit', label: '✏️ Конструктор' },
            { value: 'import', label: '📥 Получить' },
          ]}
        />
      </div>
      {msg && <div className={`mb-3 rounded-xl p-2 text-sm font-bold ${msg.ok ? 'bg-[var(--ok)]/20 text-[#b9f5d3]' : 'bg-[var(--danger)]/20 text-[#ffb3c0]'}`}>{msg.t}</div>}

      {tab === 'list' && (
        <ExamList
          exams={exams}
          onEdit={(e) => {
            setDraft(toDraft(e));
            setTab('edit');
          }}
          onShare={setShare}
          onDelete={(id) => {
            deleteCustomExam(id);
            refresh();
          }}
          onCreate={() => {
            setDraft(toDraft());
            setTab('edit');
          }}
        />
      )}
      {tab === 'edit' && <ExamEditor draft={draft} onChange={setDraft} onSave={saveDraft} onCancel={() => setTab('list')} />}
      {tab === 'import' && <ExamImport onImported={(label) => { refresh(); setTab('list'); flash(label); }} />}

      {share && <ShareModal exam={share} onClose={() => { setShare(null); refresh(); }} />}
    </div>
  );

  if (embedded) return content;
  return (
    <ScreenShell title="Свои экзамены" onBack={onBack} wide>
      {content}
    </ScreenShell>
  );
}

// ---------- Список ----------

function ExamList({ exams, onEdit, onShare, onDelete, onCreate }: {
  exams: CustomExam[]; onEdit: (e: CustomExam) => void; onShare: (e: CustomExam) => void; onDelete: (id: string) => void; onCreate: () => void;
}) {
  if (!exams.length) {
    return (
      <div className="panel p-8 text-center">
        <div className="text-5xl">📝</div>
        <div className="title-font mt-2 text-xl text-white">Пока пусто</div>
        <p className="mx-auto mt-1 max-w-md text-sm text-white/60">Создайте свой экзамен — например, по любимому предмету, — и поделитесь им с друзьями через QR-код или текстовый код.</p>
        <button className="btn btn-primary mt-4" onClick={() => { sfx.init(); sfx.click(); onCreate(); }}>＋ Создать экзамен</button>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      {exams.map((e) => (
        <div key={e.id} className="panel flex flex-wrap items-center gap-3 p-3">
          <div className="text-3xl">📝</div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-black">{e.title}</div>
            <div className="text-xs text-white/55">
              {e.questions.length} вопр.{examHasImages(e) ? ' · 🖼' : ''} · {e.origin === 'local' ? 'мой' : e.origin === 'server' ? `с сервера${e.code ? ` (${e.code})` : ''}` : e.origin === 'code' ? 'по коду' : 'из файла'}
              {e.author ? ` · ${e.author}` : ''}
            </div>
          </div>
          <button className="btn btn-cyan !px-3 !py-2 text-xs" onClick={() => { sfx.click(); onShare(e); }}>📤 Поделиться</button>
          <button className="btn btn-ghost !px-3 !py-2 text-xs" onClick={() => { sfx.click(); onEdit(e); }}>✏️</button>
          <button
            className="btn btn-ghost !px-3 !py-2 text-xs"
            onClick={() => {
              if (window.confirm(`Удалить экзамен «${e.title}»?`)) {
                sfx.click();
                onDelete(e.id);
              }
            }}
          >
            🗑
          </button>
        </div>
      ))}
      <button className="btn btn-ghost mt-1" onClick={() => { sfx.click(); onCreate(); }}>＋ Новый экзамен</button>
    </div>
  );
}

// ---------- Конструктор ----------

function ExamEditor({ draft, onChange, onSave, onCancel }: { draft: Draft; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void }) {
  const set = (p: Partial<Draft>) => onChange({ ...draft, ...p });
  const setQ = (i: number, p: Partial<CustomQuestion & { open: boolean }>) => {
    const questions = draft.questions.slice();
    questions[i] = { ...questions[i], ...p };
    set({ questions });
  };
  const good = draft.questions.filter(validQ).length;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <div className="panel grid gap-3 p-4 sm:grid-cols-2">
          <Section label="Название экзамена">
            <input className="w-full rounded-xl border-2 border-[var(--line)] bg-black/30 px-3 py-2 font-bold outline-none focus:border-[var(--accent)]" maxLength={60} placeholder="Например: Формула-1" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
          </Section>
          <Section label="Автор">
            <input className="w-full rounded-xl border-2 border-[var(--line)] bg-black/30 px-3 py-2 font-bold outline-none focus:border-[var(--accent)]" maxLength={32} placeholder="Ваш ник" value={draft.author} onChange={(e) => set({ author: e.target.value })} />
          </Section>
        </div>
        {draft.questions.map((q, i) => (
          <div key={i} className={`panel p-3 ${validQ(q) ? '' : 'border-dashed'}`}>
            <button className="flex w-full items-center gap-2 text-left" onClick={() => setQ(i, { open: !q.open })}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-black ${validQ(q) ? 'bg-[var(--ok)] text-black' : 'bg-white/10 text-white/60'}`}>{i + 1}</span>
              <span className="flex-1 truncate text-sm font-bold text-white/80">{q.q.trim() || 'Новый вопрос'}</span>
              <span className="text-white/40">{q.open ? '▲' : '▼'}</span>
            </button>
            {q.open && (
              <div className="mt-3 space-y-2">
                <textarea className="w-full rounded-xl border-2 border-[var(--line)] bg-black/30 px-3 py-2 font-bold outline-none focus:border-[var(--accent)]" rows={2} maxLength={300} placeholder={q.img ? 'Текст вопроса (необязательно, есть картинка)' : 'Текст вопроса'} value={q.q} onChange={(e) => setQ(i, { q: e.target.value })} />
                <div className="flex flex-wrap items-center gap-2">
                  {q.img ? (
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={q.img} alt="" className="h-16 w-24 rounded-lg border border-white/20 object-cover" />
                      <button className="text-xs font-bold text-[#ff8a9a]" onClick={() => setQ(i, { img: undefined })}>Убрать картинку</button>
                    </div>
                  ) : (
                    <label className="btn btn-ghost cursor-pointer !px-3 !py-1.5 text-xs">
                      🖼 Прикрепить картинку
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            const img = await compressImage(f);
                            setQ(i, { img });
                          } catch {
                            // игнор
                          }
                        }}
                      />
                    </label>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <span className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Сложность</span>
                    {([1, 2, 3] as ExamDiff[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setQ(i, { d })}
                        className="rounded-lg px-2 py-1 text-[11px] font-black"
                        style={{ background: (q.d ?? 2) === d ? EXAM_DIFF_INFO[d].color : 'rgba(255,255,255,0.08)', color: (q.d ?? 2) === d ? '#0b0e1a' : '#fff' }}
                        title={`${EXAM_DIFF_INFO[d].time} секунд на ответ`}
                      >
                        {EXAM_DIFF_INFO[d].short} {EXAM_DIFF_INFO[d].time}с
                      </button>
                    ))}
                  </div>
                </div>
                {q.options.map((o, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <button
                      title="Правильный ответ"
                      onClick={() => setQ(i, { answer: j })}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 text-lg ${q.answer === j ? 'border-[var(--ok)] bg-[var(--ok)]/20' : 'border-[var(--line)] bg-black/30'}`}
                    >
                      {q.answer === j ? '✅' : '⭕'}
                    </button>
                    <input
                      className="w-full rounded-xl border-2 border-[var(--line)] bg-black/30 px-3 py-1.5 text-sm font-bold outline-none focus:border-[var(--accent)]"
                      maxLength={150}
                      placeholder={`Вариант ${j + 1}${j === 0 ? '' : ''}`}
                      value={o}
                      onChange={(e) => {
                        const options = q.options.slice() as [string, string, string, string];
                        options[j] = e.target.value;
                        setQ(i, { options });
                      }}
                    />
                  </div>
                ))}
                <input className="w-full rounded-xl border-2 border-[var(--line)] bg-black/30 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]" maxLength={300} placeholder="Пояснение после ответа (необязательно)" value={q.note} onChange={(e) => setQ(i, { note: e.target.value })} />
                <div className="flex justify-end">
                  <button className="text-xs font-bold text-[#ff8a9a]" onClick={() => set({ questions: draft.questions.filter((_, k) => k !== i) })}>Удалить вопрос</button>
                </div>
              </div>
            )}
          </div>
        ))}
        <button className="btn btn-ghost w-full" onClick={() => { sfx.click(); set({ questions: [...draft.questions, blankQ()] }); }}>＋ Добавить вопрос ({draft.questions.length})</button>
      </div>
      <div className="panel h-fit p-4 lg:sticky lg:top-4">
        <div className="label">Готовность</div>
        <div className="mt-1 text-3xl font-black">{good}<span className="text-base text-white/50"> / {draft.questions.length}</span></div>
        <div className="mt-1 text-xs text-white/55">Заполненных вопросов. Нужно минимум 2, максимума нет. Зелёной галочкой отметьте правильный вариант. Сложность задаёт время: 20 / 30 / 40 секунд.</div>
        <button className="btn btn-primary mt-4 w-full" onClick={() => { sfx.click(); onSave(); }}>✓ Сохранить экзамен</button>
        <button className="btn btn-ghost mt-2 w-full" onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
}

// ---------- Поделиться ----------

function ShareModal({ exam, onClose }: { exam: CustomExam; onClose: () => void }) {
  const [code, setCode] = useState<string | null>(exam.code ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const textCode = encodeExamCode(exam, exam.author);
  const url = code ? examShareUrl(code) : '';

  const publish = async () => {
    setBusy(true);
    setErr(null);
    sfx.init();
    try {
      const c = await uploadExam(exam, exam.author || loadProfile().name);
      setCode(c);
      saveCustomExam({ ...exam, code: c, origin: exam.origin === 'local' ? 'local' : exam.origin });
      sfx.correct();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка публикации');
    }
    setBusy(false);
  };

  const copy = async (t: string, which: string) => {
    sfx.click();
    setCopied((await copyText(t)) ? which : null);
    if (which) window.setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Modal onClose={onClose}>
      <div className="panel mx-auto max-w-2xl p-5">
        <div className="title-font text-xl text-white">📤 «{exam.title}»</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--line)] bg-black/25 p-4">
            <div className="label">Способ 1 · Код + QR</div>
            <p className="mt-1 text-xs text-white/60">Для игроков на этом же сервере (идеально для локальной сети).</p>
            {!code ? (
              <button className="btn btn-primary mt-3 w-full" disabled={busy} onClick={publish}>{busy ? 'Публикация…' : 'Опубликовать'}</button>
            ) : (
              <div className="mt-2 flex flex-col items-center gap-2">
                <div className="font-mono text-4xl font-black tracking-[0.2em] text-[var(--accent)]">{code}</div>
                <QrCode text={url} size={180} />
                <div className="flex w-full gap-2">
                  <button className="btn btn-ghost flex-1 !px-2 !py-2 text-xs" onClick={() => copy(code, 'code')}>{copied === 'code' ? '✓ Скопировано' : 'Копировать код'}</button>
                  <button className="btn btn-ghost flex-1 !px-2 !py-2 text-xs" onClick={() => copy(url, 'url')}>{copied === 'url' ? '✓ Скопировано' : 'Копировать ссылку'}</button>
                </div>
                <button className="text-xs font-bold text-white/50" disabled={busy} onClick={publish}>Опубликовать заново (новый код)</button>
              </div>
            )}
            {err && <div className="mt-2 rounded-lg bg-[var(--danger)]/20 p-2 text-xs font-bold text-[#ffb3c0]">{err}</div>}
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-[var(--line)] bg-black/25 p-4">
              <div className="label">Способ 2 · Текстовый код</div>
              <p className="mt-1 text-xs text-white/60">Работает везде, даже без сервера: отправьте код в мессенджер.{examHasImages(exam) ? ' Картинки в текстовый код не входят — для них используйте код сервера или файл.' : ''}</p>
              <textarea readOnly className="mt-2 h-20 w-full rounded-xl border border-[var(--line)] bg-black/40 p-2 font-mono text-[10px] break-all text-white/80" value={textCode} onFocus={(e) => e.target.select()} />
              <button className="btn btn-cyan mt-2 w-full !py-2 text-xs" onClick={() => copy(textCode, 'txt')}>{copied === 'txt' ? '✓ Скопировано' : 'Копировать код'}</button>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-black/25 p-4">
              <div className="label">Способ 3 · Файл</div>
              <button className="btn btn-ghost mt-2 w-full !py-2 text-xs" onClick={() => { sfx.click(); downloadTextFile(`exam-${exam.title.slice(0, 20)}.json`, examToFile(exam)); }}>💾 Скачать .json</button>
            </div>
          </div>
        </div>
        <button className="btn btn-ghost mt-4 w-full" onClick={onClose}>Закрыть</button>
      </div>
    </Modal>
  );
}

// ---------- Получить ----------

function ExamImport({ onImported }: { onImported: (label: string) => void }) {
  const [serverCode, setServerCode] = useState('');
  const [textCode, setTextCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scan, setScan] = useState(false);
  const [recent, setRecent] = useState<{ code: string; title: string; author: string; count: number; downloads: number }[] | null>(null);

  const saveIncoming = (pack: { id: string; title: string; questions: CustomQuestion[] }, author: string, origin: CustomExam['origin'], code?: string) => {
    saveCustomExam({ ...pack, id: newExamId(), author, updatedAt: Date.now(), origin, code });
    sfx.correct();
    onImported(`Экзамен «${pack.title}» добавлен: ${pack.questions.length} вопр.`);
  };

  const byServerCode = async (c: string) => {
    setBusy(true);
    setErr(null);
    try {
      const { pack, author } = await fetchExamByCode(c);
      saveIncoming(pack, author, 'server', c.toUpperCase());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка загрузки');
      setBusy(false);
    }
  };

  const byText = () => {
    const r = decodeExamCode(textCode);
    if (!r) {
      setErr('Не похож на код экзамена. Код начинается с BNR1.');
      return;
    }
    saveIncoming(r.pack, r.author, 'code');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const r = examFromFile(await f.text());
      if (!r) {
        setErr('Файл не похож на экзамен из этой игры');
        return;
      }
      saveIncoming(r.pack, r.author, 'file');
    } catch {
      setErr('Не удалось прочитать файл');
    }
  };

  const onQr = async (text: string) => {
    setScan(false);
    const asText = decodeExamCode(text);
    if (asText) {
      saveIncoming(asText.pack, asText.author, 'code');
      return;
    }
    const c = extractServerCode(text);
    if (c) {
      await byServerCode(c);
      return;
    }
    setErr('QR-код не похож на экзамен из этой игры');
  };

  const loadRecent = async () => {
    setBusy(true);
    try {
      setRecent(await fetchRecentExams());
    } catch {
      setErr('Не удалось загрузить список сервера');
    }
    setBusy(false);
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="panel space-y-4 p-4">
        <Section label="📷 Сканировать QR-код">
          <button className="btn btn-primary w-full" onClick={() => { sfx.init(); sfx.click(); setScan(true); }}>Открыть сканер</button>
        </Section>
        <Section label="🔑 Код с сервера (6 символов)">
          <div className="flex gap-2">
            <input className="w-full rounded-xl border-2 border-[var(--line)] bg-black/30 px-3 py-2 text-center font-mono text-xl font-black tracking-[0.25em] uppercase outline-none focus:border-[var(--accent)]" maxLength={8} placeholder="ABCDEF" value={serverCode} onChange={(e) => setServerCode(e.target.value.toUpperCase())} />
            <button className="btn btn-cyan" disabled={busy || serverCode.trim().length < 4} onClick={() => byServerCode(serverCode)}>Взять</button>
          </div>
        </Section>
        <Section label="📋 Текстовый код (начинается с BNR1.)">
          <textarea className="h-20 w-full rounded-xl border-2 border-[var(--line)] bg-black/30 p-2 font-mono text-[11px] break-all outline-none focus:border-[var(--accent)]" placeholder="Вставьте код из мессенджера…" value={textCode} onChange={(e) => setTextCode(e.target.value)} />
          <button className="btn btn-cyan mt-2 w-full !py-2" disabled={!textCode.trim()} onClick={byText}>Импортировать</button>
        </Section>
        <Section label="💾 Файл .json">
          <label className="btn btn-ghost w-full cursor-pointer">
            Выбрать файл
            <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </Section>
        {err && <div className="rounded-lg bg-[var(--danger)]/20 p-2 text-sm font-bold text-[#ffb3c0]">{err}</div>}
      </div>
      <div className="panel h-fit p-4">
        <div className="label">🆕 Недавние на этом сервере</div>
        {recent === null ? (
          <button className="btn btn-ghost mt-3 w-full" disabled={busy} onClick={loadRecent}>Показать список</button>
        ) : recent.length === 0 ? (
          <div className="mt-3 text-sm text-white/60">Здесь пока никто ничего не публиковал. Станьте первым!</div>
        ) : (
          <div className="mt-2 grid gap-2">
            {recent.map((r) => (
              <div key={r.code} className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-black/25 p-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black">{r.title}</div>
                  <div className="font-mono text-[11px] text-[var(--accent)]">{r.code} · {r.count} вопр.{r.author ? ` · ${r.author}` : ''}</div>
                </div>
                <button className="btn btn-cyan !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => byServerCode(r.code)}>Взять</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {scan && (
        <Modal onClose={() => setScan(false)}>
          <div className="panel mx-auto max-w-md p-5">
            <div className="title-font mb-3 text-center text-xl text-white">Наведите камеру на QR</div>
            <QrScanner onResult={onQr} onClose={() => setScan(false)} />
          </div>
        </Modal>
      )}
    </div>
  );
}
