'use client';

import { useEffect, useState } from 'react';
import GameView, { GameConfig } from './GameView';
import MatchSetup from './MatchSetup';
import NetworkScreen from './NetworkScreen';
import ControlsScreen from './ControlsScreen';
import ExamsScreen from './ExamsScreen';
import OrientationGate from './OrientationGate';
import { CustomizeScreen, HelpScreen, HighScoresScreen, MainMenu, SettingsScreen } from './MenuScreens';
import { ScreenShell } from './ui';
import {
  isTouchDevice, loadKeys, loadPrefs, loadProfile, loadSettings, loadTouchLayout, newExamId, Prefs, Profile,
  saveCustomExam, saveKeys, savePrefs, saveProfile, saveSettings, saveTouchLayout, type KeyBindings, type TouchLayout,
} from '@/game/client/storage';
import { fetchExamByCode } from '@/game/client/exams';
import { sfx } from '@/game/client/audio';
import type { MapLayout, MapTheme, MatchSettings } from '@/game/shared/types';

type Screen =
  | { s: 'menu' }
  | { s: 'solo' }
  | { s: 'net' }
  | { s: 'custom' }
  | { s: 'scores' }
  | { s: 'help' }
  | { s: 'settings' }
  | { s: 'controls' }
  | { s: 'exams' }
  | { s: 'game'; cfg: GameConfig; key: number };

export default function GameApp() {
  const [screen, setScreen] = useState<Screen>({ s: 'menu' });
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [touchLayout, setTouchLayout] = useState<TouchLayout>(() => loadTouchLayout());
  const [keys, setKeys] = useState<KeyBindings>(() => loadKeys());
  const [touch] = useState(() => isTouchDevice());
  const [notice, setNotice] = useState<string | null>(null);

  // Импорт экзамена по ссылке ?exam=КОД (из QR-кода или мессенджера)
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get('exam');
      if (!code) return;
      window.history.replaceState({}, '', window.location.pathname);
      fetchExamByCode(code)
        .then(({ pack, author }) => {
          saveCustomExam({ ...pack, id: newExamId(), author, updatedAt: Date.now(), origin: 'server', code: code.toUpperCase() });
          setScreen({ s: 'exams' });
          setNotice(`Экзамен «${pack.title}» добавлен!`);
          window.setTimeout(() => setNotice(null), 4000);
        })
        .catch((e: unknown) => {
          setNotice(e instanceof Error ? e.message : 'Не удалось загрузить экзамен');
          window.setTimeout(() => setNotice(null), 4000);
        });
    } catch {
      // игнор
    }
  }, []);

  const updatePrefs = (p: Prefs) => {
    setPrefs(p);
    savePrefs(p);
    sfx.setVolume(p.volume);
  };

  const startSolo = (s: MatchSettings) => {
    sfx.init();
    setScreen({ s: 'game', cfg: { kind: 'solo', settings: s }, key: Date.now() });
  };

  const quick = () => {
    const base = loadSettings();
    const layouts: MapLayout[] = ['arena', 'city', 'warehouse', 'ruins'];
    const themes: MapTheme[] = ['day', 'sunset', 'night', 'snow'];
    startSolo({
      mode: 'coop',
      map: {
        layout: layouts[Math.floor(Math.random() * layouts.length)],
        size: 's',
        density: 'mid',
        theme: themes[Math.floor(Math.random() * themes.length)],
        seed: Math.floor(Math.random() * 999999),
      },
      topics: base.topics.length ? base.topics : ['flags', 'history', 'law'],
      packs: [],
      bots: 7,
      difficulty: 'normal',
      duration: 180,
    });
  };

  if (screen.s === 'game') {
    return (
      <GameView
        key={screen.key}
        config={screen.cfg}
        profile={profile}
        prefs={prefs}
        touch={touch}
        touchLayout={touchLayout}
        keys={keys}
        onPrefs={updatePrefs}
        onExit={() => setScreen({ s: 'menu' })}
      />
    );
  }

  let content: React.ReactNode = null;
  switch (screen.s) {
    case 'solo':
      content = (
        <ScreenShell title="Одиночная игра" onBack={() => setScreen({ s: 'menu' })} wide>
          <MatchSetup
            initial={loadSettings()}
            variant="solo"
            submitLabel="▶ В бой"
            onCancel={() => setScreen({ s: 'menu' })}
            onSubmit={(s) => {
              saveSettings(s);
              startSolo(s);
            }}
          />
        </ScreenShell>
      );
      break;
    case 'net':
      content = (
        <NetworkScreen
          profile={profile}
          onBack={() => setScreen({ s: 'menu' })}
          onJoin={(c) => setScreen({ s: 'game', cfg: { kind: 'online', ...c }, key: Date.now() })}
        />
      );
      break;
    case 'custom':
      content = (
        <CustomizeScreen
          profile={profile}
          onBack={() => setScreen({ s: 'menu' })}
          onSave={(p) => {
            setProfile(p);
            saveProfile(p);
            setScreen({ s: 'menu' });
          }}
        />
      );
      break;
    case 'scores':
      content = <HighScoresScreen onBack={() => setScreen({ s: 'menu' })} />;
      break;
    case 'help':
      content = <HelpScreen onBack={() => setScreen({ s: 'menu' })} />;
      break;
    case 'settings':
      content = <SettingsScreen prefs={prefs} onChange={updatePrefs} onBack={() => setScreen({ s: 'menu' })} />;
      break;
    case 'controls':
      content = (
        <ControlsScreen
          touch={touchLayout}
          keys={keys}
          isTouch={touch}
          onBack={() => setScreen({ s: 'menu' })}
          onSave={(t, k) => {
            setTouchLayout(t);
            setKeys(k);
            saveTouchLayout(t);
            saveKeys(k);
            setScreen({ s: 'menu' });
          }}
        />
      );
      break;
    case 'exams':
      content = <ExamsScreen onBack={() => setScreen({ s: 'menu' })} />;
      break;
    default:
      content = (
        <MainMenu
          profile={profile}
          onQuick={quick}
          onSolo={() => setScreen({ s: 'solo' })}
          onNet={() => setScreen({ s: 'net' })}
          onCustom={() => setScreen({ s: 'custom' })}
          onScores={() => setScreen({ s: 'scores' })}
          onHelp={() => setScreen({ s: 'help' })}
          onSettings={() => setScreen({ s: 'settings' })}
          onControls={() => setScreen({ s: 'controls' })}
          onExams={() => setScreen({ s: 'exams' })}
        />
      );
  }

  return (
    <>
      {content}
      <OrientationGate touch={touch} inGame={false} />
      {notice && (
        <div className="fixed top-4 left-1/2 z-[80] -translate-x-1/2 rounded-2xl border border-[var(--accent)] bg-black/85 px-5 py-3 text-sm font-bold text-white shadow-2xl pop-in">
          {notice}
        </div>
      )}
    </>
  );
}
