'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import FlagSvg from './FlagSvg';
import { sfx } from '@/game/client/audio';
import { PreparedQuestion, QuestionDeck } from '@/game/shared/questions';
import {
  answerPoints, availableWeapons, EXAM_DIFF_INFO, ExamDiff, ShotWeapon, TOPIC_INFO, TopicId, unlockedCount, WEAPON_ORDER, WeaponId, WEAPONS,
} from '@/game/shared/types';

const ICONS: Record<WeaponId, string> = { rpg: '🚀', lmg: '🔥', sniper: '🎯', rifle: '⚡', shotgun: '💥', smg: '🌀', pistol: '🔫' };

interface Props {
  deck: QuestionDeck;
  entrance: boolean;
  killer: string | null;
  killerWeapon: ShotWeapon | null;
  onDone: (w: WeaponId, correct: boolean, time: number, topic: TopicId, d: ExamDiff) => void;
}

type Stage = 'question' | 'result' | 'pick';

export default function ExamOverlay({ deck, entrance, killer, onDone }: Props) {
  const [q] = useState<PreparedQuestion>(() => deck.draw());
  const T = q.time;
  const [stage, setStage] = useState<Stage>('question');
  const [elapsed, setElapsed] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(false);
  const [answerTime, setAnswerTime] = useState(T);
  const [pickLeft, setPickLeft] = useState(8);
  const startRef = useRef(0);
  const lastTick = useRef(-1);
  const lastUnlocked = useRef(WEAPON_ORDER.length);
  const [lockPulse, setLockPulse] = useState(0);
  const doneRef = useRef(false);
  const stageRef = useRef<Stage>('question');
  stageRef.current = stage;

  const choose = useCallback(
    (idx: number | null) => {
      if (stageRef.current !== 'question') return;
      const t = Math.min(T, (performance.now() - startRef.current) / 1000);
      const ok = idx !== null && idx === q.answer;
      setPicked(idx);
      setCorrect(ok);
      setAnswerTime(t);
      setStage('result');
      stageRef.current = 'result';
      if (ok) sfx.correct();
      else sfx.wrong();
      window.setTimeout(() => {
        setStage('pick');
        stageRef.current = 'pick';
      }, ok ? 1200 : 2600);
    },
    [q.answer, T],
  );

  const finish = useCallback(
    (w: WeaponId) => {
      if (doneRef.current) return;
      doneRef.current = true;
      sfx.click();
      onDone(w, correct, answerTime, q.topic, q.d);
    },
    [correct, answerTime, q.topic, q.d, onDone],
  );

  useEffect(() => {
    startRef.current = performance.now();
    const id = window.setInterval(() => {
      if (stageRef.current !== 'question') return;
      const e = (performance.now() - startRef.current) / 1000;
      setElapsed(e);
      const left = Math.ceil(T - e);
      if (left <= 5 && left !== lastTick.current && left > 0) sfx.tick(true);
      lastTick.current = left;
      const u = unlockedCount(true, e, T);
      if (u < lastUnlocked.current) {
        lastUnlocked.current = u;
        sfx.lock();
        setLockPulse((p) => p + 1);
      }
      if (e >= T) choose(null);
    }, 100);
    return () => window.clearInterval(id);
  }, [choose, T]);

  const avail = stage === 'question' ? availableWeapons(true, elapsed, T) : availableWeapons(correct, answerTime, T);

  useEffect(() => {
    if (stage !== 'pick') return;
    const start = performance.now();
    const id = window.setInterval(() => {
      const left = 8 - (performance.now() - start) / 1000;
      setPickLeft(Math.max(0, left));
      if (left <= 0) finish(availableWeapons(correct, answerTime, T)[0]);
    }, 100);
    return () => window.clearInterval(id);
  }, [stage, correct, answerTime, finish, T]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (stageRef.current === 'question' && n >= 1 && n <= 4) {
        e.preventDefault();
        choose(n - 1);
      } else if (stageRef.current === 'pick') {
        const list = availableWeapons(correct, answerTime, T);
        if (n >= 1 && n <= WEAPON_ORDER.length) {
          const w = WEAPON_ORDER[n - 1];
          if (list.includes(w)) finish(w);
        } else if (e.key === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          finish(list[0]);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, finish, correct, answerTime, T]);

  const left = Math.max(0, T - (stage === 'question' ? elapsed : answerTime));
  const frac = left / T;
  const diff = EXAM_DIFF_INFO[q.d];
  const barColor = frac > 0.5 ? '#2fbf71' : frac > 0.2 ? '#f0a500' : '#e5383b';
  const topic = TOPIC_INFO[q.topic];
  const timedOut = stage !== 'question' && picked === null;
  const ticketNo = q.id >= 100000 ? q.id - 99999 : q.id;
  const badgeBg = topic.color === '#ffc53d' ? '#c98a00' : topic.color === '#36d6ff' ? '#0b86b0' : topic.color === '#7dff5a' ? '#2f9e44' : '#c2185b';
  const badgeLabel = q.topic === 'custom' ? (q.pack ?? topic.title) : topic.title;

  return (
    <div className="exam-overlay fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-[rgba(6,8,18,0.72)] p-2 sm:items-center sm:p-4 no-select">
      <div className="exam-wrap w-full max-w-3xl py-2">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2 px-1">
          <div className="title-font text-xl text-white sm:text-2xl">
            {entrance ? (
              <span className="text-[var(--accent2)]">Вступительный экзамен</span>
            ) : (
              <>
                <span className="text-[var(--danger)]">Вы убиты</span>
                {killer && <span className="ml-2 text-base font-bold not-italic text-white/70 normal-case">— {killer}</span>}
              </>
            )}
          </div>
          <div className="text-xs font-bold tracking-wider text-white/60 uppercase">Сдай билет, чтобы вернуться в бой</div>
        </div>

        <div className="ticket slide-up p-4 sm:p-7">
          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-black tracking-[0.2em] text-[#6b5e4b] uppercase sm:text-xs">Экзаменационный билет № {ticketNo}</div>
              <div className="flex max-w-full items-center gap-1.5">
                <div className="truncate rounded-full px-3 py-1 text-xs font-black text-white uppercase" style={{ background: badgeBg }}>
                  {topic.icon} {badgeLabel}
                </div>
                <div className="rounded-full px-2.5 py-1 text-[11px] font-black whitespace-nowrap text-[#1b1405] uppercase" style={{ background: diff.color }} title={`${diff.time} секунд на ответ`}>
                  {diff.title} · {diff.time} с
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/10">
                <div className="h-full rounded-full transition-[width] duration-100 ease-linear" style={{ width: `${frac * 100}%`, background: barColor }} />
              </div>
              <div className={`w-14 text-right text-2xl font-black tabular-nums ${frac <= 0.2 && stage === 'question' ? 'text-[#e5383b] pulse-soft' : ''}`}>{Math.ceil(left)}с</div>
            </div>

            <div className="exam-q mt-4 text-lg leading-snug font-extrabold sm:text-2xl">{q.q}</div>

            {q.img && (
              <div className="exam-flag mt-3 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={q.img} alt="Иллюстрация к вопросу" className="max-h-[220px] max-w-full rounded-lg border-2 border-black/20 object-contain shadow-lg" />
              </div>
            )}

            {q.flag && (
              <div className="exam-flag mt-3 flex justify-center">
                <div className="overflow-hidden rounded-md border-2 border-black/20 shadow-lg" style={{ width: 'min(260px, 60vw)' }}>
                  <FlagSvg code={q.flag} className="block h-auto w-full" />
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {q.shuffled.map((opt, i) => {
                const isAns = i === q.answer;
                const isPicked = i === picked;
                let style = '';
                if (stage !== 'question') {
                  if (isAns) style = '!border-[#2fbf71] !bg-[#d8f5e4]';
                  else if (isPicked) style = '!border-[#e5383b] !bg-[#fbd9da] shake-x';
                  else style = 'opacity-45';
                }
                return (
                  <button
                    key={i}
                    className={`ticket-answer flex items-center gap-3 px-3 py-3 text-left text-[15px] sm:text-base ${style}`}
                    disabled={stage !== 'question'}
                    onClick={() => choose(i)}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#221d17] text-sm font-black text-[var(--paper)]">{i + 1}</span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>

            {stage !== 'question' && (
              <div className="mt-4 flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
                <div className={`stamp text-2xl sm:text-3xl ${correct ? 'text-[#1f9d57]' : 'text-[#d62839]'}`}>{correct ? 'Сдано!' : timedOut ? 'Время вышло' : 'Не сдано'}</div>
                <div className="text-sm font-semibold text-[#4a4034] sm:ml-3">
                  {correct ? <b>+{answerPoints(true, answerTime, T, q.d)} очков за ответ. </b> : <b>Правильно: «{q.options[0]}». </b>}
                  {q.note}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="panel mt-3 p-3 sm:p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="label">{stage === 'pick' ? 'Выберите оружие (клавиши 1–7)' : 'Оружие на выбор'}</div>
            <div className="text-xs font-bold text-white/60">
              {stage === 'question' && `Каждые ${Math.round((T / 6) * 10) / 10} с лучшее оружие блокируется. Ошибка — только пистолет.`}
              {stage === 'result' && (correct ? `Доступно: ${avail.length} из 7` : 'Остался только пистолет')}
              {stage === 'pick' && <span className="text-[var(--accent)]">Автовыбор через {Math.ceil(pickLeft)} с</span>}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {WEAPON_ORDER.map((w, i) => {
              const wd = WEAPONS[w];
              const ok = avail.includes(w);
              const best = stage === 'pick' && w === avail[0];
              const lastLocked = stage === 'question' && !ok && WEAPON_ORDER.length - avail.length - 1 === i;
              return (
                <button
                  key={w + (lastLocked ? lockPulse : '')}
                  disabled={stage !== 'pick' || !ok}
                  onClick={() => finish(w)}
                  className={`relative flex flex-col items-center rounded-xl border-2 px-1 py-2 text-center transition-all ${
                    ok ? 'border-white/20 bg-white/5' : 'border-white/5 bg-black/40 opacity-40 grayscale'
                  } ${stage === 'pick' && ok ? 'cursor-pointer hover:-translate-y-1 hover:border-[var(--accent)] hover:bg-white/10' : ''} ${best ? '!border-[var(--accent)] shadow-[0_0_24px_rgba(255,197,61,0.35)]' : ''} ${lastLocked ? 'lock-in' : ''}`}
                  style={ok ? { boxShadow: best ? undefined : `inset 0 -3px 0 ${wd.color}` } : undefined}
                >
                  <span className="absolute top-1 left-1.5 text-[10px] font-black text-white/40">{i + 1}</span>
                  <span className="text-2xl">{ok ? ICONS[w] : '🔒'}</span>
                  <span className="mt-1 text-[11px] leading-tight font-black text-white sm:text-xs">{wd.name}</span>
                  <span className="hidden text-[10px] leading-tight text-white/55 sm:block">{wd.kind}</span>
                  <span className="mt-1 flex gap-0.5">
                    {Array.from({ length: 5 }, (_, k) => (
                      <span key={k} className="h-1.5 w-2 rounded-sm" style={{ background: k < wd.power ? wd.color : 'rgba(255,255,255,0.12)' }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          {stage === 'pick' && (
            <div className="mt-3 flex justify-center">
              <button className="btn btn-primary w-full sm:w-auto" onClick={() => finish(avail[0])}>
                В бой с «{WEAPONS[avail[0]].name}» ⏎
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
