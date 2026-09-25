'use client';

import { useId, type ReactNode } from 'react';

function star(cx: number, cy: number, R: number, rot = -Math.PI / 2, n = 5, inner = 0.382): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? R : R * inner;
    const a = rot + (i * Math.PI) / n;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(' ');
}

const LEAF =
  'M4890 4430l-45-863a95 95 0 0 1 111-98l859 151-116-320a65 65 0 0 1 20-73l941-762-212-99a65 65 0 0 1-34-79l186-572-542 115a65 65 0 0 1-73-38l-105-247-423 454a65 65 0 0 1-111-57l204-1052-327 189a65 65 0 0 1-91-27l-332-652-332 652a65 65 0 0 1-91 27l-327-189 204 1052a65 65 0 0 1-111 57l-423-454-105 247a65 65 0 0 1-73 38l-542-115 186 572a65 65 0 0 1-34 79l-212 99 941 762a65 65 0 0 1 20 73l-116 320 859-151a95 95 0 0 1 111 98l-45 863z';

function hStripes(w: number, h: number, colors: string[]): ReactNode {
  const sh = h / colors.length;
  return colors.map((c, i) => <rect key={i} x={0} y={i * sh} width={w} height={sh + 0.5} fill={c} />);
}

function vStripes(w: number, h: number, colors: string[]): ReactNode {
  const sw = w / colors.length;
  return colors.map((c, i) => <rect key={i} x={i * sw} y={0} width={sw + 0.5} height={h} fill={c} />);
}

export default function FlagSvg({ code, className }: { code: string; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  let vb = '0 0 900 600';
  let body: ReactNode = null;
  switch (code) {
    case 'ru':
      body = hStripes(900, 600, ['#ffffff', '#0039a6', '#d52b1e']);
      break;
    case 'de':
      vb = '0 0 500 300';
      body = hStripes(500, 300, ['#000000', '#dd0000', '#ffce00']);
      break;
    case 'fr':
      body = vStripes(900, 600, ['#002395', '#ffffff', '#ed2939']);
      break;
    case 'it':
      body = vStripes(900, 600, ['#009246', '#ffffff', '#ce2b37']);
      break;
    case 'jp':
      body = (
        <>
          <rect width={900} height={600} fill="#ffffff" />
          <circle cx={450} cy={300} r={180} fill="#bc002d" />
        </>
      );
      break;
    case 'gb':
      vb = '0 0 60 30';
      body = (
        <>
          <defs>
            <clipPath id={`gbs${uid}`}>
              <path d="M0,0 v30 h60 v-30 z" />
            </clipPath>
            <clipPath id={`gbt${uid}`}>
              <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
            </clipPath>
          </defs>
          <g clipPath={`url(#gbs${uid})`}>
            <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" strokeWidth={6} />
            <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#gbt${uid})`} stroke="#c8102e" strokeWidth={4} />
            <path d="M30,0 v30 M0,15 h60" stroke="#ffffff" strokeWidth={10} />
            <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth={6} />
          </g>
        </>
      );
      break;
    case 'us': {
      vb = '0 0 190 100';
      const stripes = Array.from({ length: 13 }, (_, i) => (
        <rect key={i} x={0} y={(i * 100) / 13} width={190} height={100 / 13 + 0.2} fill={i % 2 === 0 ? '#b22234' : '#ffffff'} />
      ));
      const stars: ReactNode[] = [];
      for (let r = 0; r < 9; r++) {
        const count = r % 2 === 0 ? 6 : 5;
        for (let k = 0; k < count; k++) {
          const x = 6.333 * (r % 2 === 0 ? 1 + 2 * k : 2 + 2 * k);
          const y = 5.385 * (r + 1);
          stars.push(<polygon key={`${r}-${k}`} points={star(x, y, 2.4)} fill="#ffffff" />);
        }
      }
      body = (
        <>
          {stripes}
          <rect x={0} y={0} width={76} height={53.85} fill="#3c3b6e" />
          {stars}
        </>
      );
      break;
    }
    case 'se':
      vb = '0 0 16 10';
      body = (
        <>
          <rect width={16} height={10} fill="#006aa7" />
          <rect x={5} y={0} width={2} height={10} fill="#fecc00" />
          <rect x={0} y={4} width={16} height={2} fill="#fecc00" />
        </>
      );
      break;
    case 'fi':
      vb = '0 0 18 11';
      body = (
        <>
          <rect width={18} height={11} fill="#ffffff" />
          <rect x={5} y={0} width={3} height={11} fill="#002f6c" />
          <rect x={0} y={4} width={18} height={3} fill="#002f6c" />
        </>
      );
      break;
    case 'no':
      vb = '0 0 22 16';
      body = (
        <>
          <rect width={22} height={16} fill="#ba0c2f" />
          <rect x={6} y={0} width={4} height={16} fill="#ffffff" />
          <rect x={0} y={6} width={22} height={4} fill="#ffffff" />
          <rect x={7} y={0} width={2} height={16} fill="#00205b" />
          <rect x={0} y={7} width={22} height={2} fill="#00205b" />
        </>
      );
      break;
    case 'ch':
      vb = '0 0 32 32';
      body = (
        <>
          <rect width={32} height={32} fill="#da291c" />
          <rect x={13} y={6} width={6} height={20} fill="#ffffff" />
          <rect x={6} y={13} width={20} height={6} fill="#ffffff" />
        </>
      );
      break;
    case 'br': {
      vb = '0 0 1000 700';
      const dots = [[430, 390], [470, 420], [520, 400], [560, 430], [600, 410], [500, 460], [450, 445], [545, 470], [610, 450]];
      body = (
        <>
          <defs>
            <clipPath id={`brc${uid}`}>
              <circle cx={500} cy={350} r={175} />
            </clipPath>
          </defs>
          <rect width={1000} height={700} fill="#009c3b" />
          <polygon points="85,350 500,85 915,350 500,615" fill="#ffdf00" />
          <circle cx={500} cy={350} r={175} fill="#002776" />
          <g clipPath={`url(#brc${uid})`}>
            <path d="M 250 390 Q 500 230 760 420" stroke="#ffffff" strokeWidth={30} fill="none" />
          </g>
          {dots.map(([x, y], i) => (
            <polygon key={i} points={star(x, y, 9)} fill="#ffffff" />
          ))}
        </>
      );
      break;
    }
    case 'cn': {
      vb = '0 0 30 20';
      const small: [number, number][] = [[10, 2], [12, 4], [12, 7], [10, 9]];
      body = (
        <>
          <rect width={30} height={20} fill="#ee1c25" />
          <polygon points={star(5, 5, 3)} fill="#ffff00" />
          {small.map(([x, y], i) => (
            <polygon key={i} points={star(x, y, 1, Math.atan2(5 - y, 5 - x))} fill="#ffff00" />
          ))}
        </>
      );
      break;
    }
    case 'ca':
      vb = '0 0 9600 4800';
      body = (
        <>
          <rect width={9600} height={4800} fill="#d52b1e" />
          <rect x={2400} width={4800} height={4800} fill="#ffffff" />
          <path d={LEAF} fill="#d52b1e" />
        </>
      );
      break;
    case 'in': {
      const spokes = Array.from({ length: 24 }, (_, i) => {
        const a = (i * Math.PI * 2) / 24;
        return <line key={i} x1={450} y1={300} x2={450 + Math.cos(a) * 68} y2={300 + Math.sin(a) * 68} stroke="#000080" strokeWidth={3} />;
      });
      body = (
        <>
          {hStripes(900, 600, ['#ff9933', '#ffffff', '#138808'])}
          <circle cx={450} cy={300} r={72} fill="none" stroke="#000080" strokeWidth={9} />
          {spokes}
          <circle cx={450} cy={300} r={13} fill="#000080" />
        </>
      );
      break;
    }
    case 'tr':
      vb = '0 0 1500 1000';
      body = (
        <>
          <rect width={1500} height={1000} fill="#e30a17" />
          <circle cx={500} cy={500} r={250} fill="#ffffff" />
          <circle cx={562.5} cy={500} r={200} fill="#e30a17" />
          <polygon points={star(900, 500, 125, Math.PI)} fill="#ffffff" />
        </>
      );
      break;
    case 'gr':
      vb = '0 0 27 18';
      body = (
        <>
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} x={0} y={i * 2} width={27} height={2.05} fill={i % 2 === 0 ? '#0d5eaf' : '#ffffff'} />
          ))}
          <rect x={0} y={0} width={10} height={10} fill="#0d5eaf" />
          <rect x={4} y={0} width={2} height={10} fill="#ffffff" />
          <rect x={0} y={4} width={10} height={2} fill="#ffffff" />
        </>
      );
      break;
    case 'cz':
      body = (
        <>
          <rect width={900} height={300} fill="#ffffff" />
          <rect y={300} width={900} height={300} fill="#d7141a" />
          <polygon points="0,0 450,300 0,600" fill="#11457e" />
        </>
      );
      break;
    case 'ar':
      vb = '0 0 800 500';
      body = (
        <>
          {hStripes(800, 500, ['#74acdf', '#ffffff', '#74acdf'])}
          <polygon points={star(400, 250, 62, 0, 16, 0.62)} fill="#f6b40e" />
          <circle cx={400} cy={250} r={34} fill="#f6b40e" stroke="#85340a" strokeWidth={2} />
        </>
      );
      break;
    case 'vn':
      body = (
        <>
          <rect width={900} height={600} fill="#da251d" />
          <polygon points={star(450, 300, 170)} fill="#ffff00" />
        </>
      );
      break;
    default:
      body = <rect width={900} height={600} fill="#888" />;
  }
  return (
    <svg viewBox={vb} className={className} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Флаг">
      {body}
    </svg>
  );
}
