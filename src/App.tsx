import { useCallback, useEffect, useRef, useState } from 'react';
import { ControlsModal } from './components/ControlsModal';
import { GameHud } from './components/GameHud';
import { PyramidMapModal } from './components/PyramidMapModal';
import { StoryJournalModal } from './components/StoryJournalModal';
import { PyramidWorld } from './game/PyramidWorld';
import { soundEngine } from './game/audio';
import { ZONE_NAMES } from './game/story';
import { HudSnapshot } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  zoneId: 'forecourt',
  zoneName: ZONE_NAMES.forecourt,
  health: 100,
  maxHealth: 100,
  solarEnergy: 100,
  maxSolarEnergy: 100,
  gold: 0,
  treasuresFound: 0,
  totalTreasures: 8,
  secretsFound: 0,
  totalSecrets: 2,
  puzzlesSolved: 0,
  totalPuzzles: 3,
  mummiesDefeated: 0,
  elapsedSeconds: 0,
  interactPrompt: null,
  bannerMessage: null,
  pointerLocked: false,
  unlockedStories: ['prologue'],
  activeStoryModalId: null,
  puzzle1States: [1, 2, 0],
  puzzle2Progress: 0,
  puzzle3MirrorsAligned: false,
  bossHealthRatio: null,
  hurtFlash: 0,
  visitedZones: ['forecourt'],
  playerX: 0,
  playerZ: 18.5,
  playerYaw: 0,
  objectiveText: 'Vorhalle: Drehe die 3 Hieroglyphen-Säulen auf Falke · Skarabäus · Ankh.',
  hasCheckpoint: false,
  checkpointZoneName: null,
  targetedMummy: null,
  puzzle1Solved: false,
  puzzle2Solved: false,
  secret1Opened: false,
  secret2Opened: false,
};

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

const BEST_GOLD_KEY = 'geheimnis_pyramiden_best_gold';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<PyramidWorld | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [sensitivity, setSensitivity] = useState(1.0);
  const [invertY, setInvertY] = useState(false);
  // Auto-enable the on-screen D-pad on touch-first devices (no physical keyboard).
  const [showTouchPad, setShowTouchPad] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches,
  );
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [bestGold, setBestGold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(BEST_GOLD_KEY);
      return saved ? Number(saved) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const [webglError, setWebglError] = useState(false);

  // Sync best gold when gold increases
  useEffect(() => {
    if (hud.gold > bestGold) {
      setBestGold(hud.gold);
      try {
        localStorage.setItem(BEST_GOLD_KEY, String(hud.gold));
      } catch {
        // ignore storage restrictions
      }
    }
  }, [hud.gold, bestGold]);

  // Keep refs for clean keyboard handling without tearing down listeners
  const phaseRef = useRef(hud.phase);
  phaseRef.current = hud.phase;
  const activeModalRef = useRef(hud.activeStoryModalId);
  activeModalRef.current = hud.activeStoryModalId;
  const journalOpenRef = useRef(journalOpen);
  journalOpenRef.current = journalOpen;
  const mapOpenRef = useRef(mapOpen);
  mapOpenRef.current = mapOpen;
  const controlsOpenRef = useRef(controlsOpen);
  controlsOpenRef.current = controlsOpen;

  // Keyboard shortcuts for Journal ('J'), Map ('M'), Controls ('K'), Escape closing modals, and Mute ('T')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyJ' && worldRef.current) {
        const phase = phaseRef.current;
        if (phase !== 'playing' && phase !== 'paused') return;
        if (activeModalRef.current) {
          worldRef.current.openStoryModal(null);
          return;
        }
        setMapOpen(false);
        setControlsOpen(false);
        setJournalOpen((prev) => {
          const next = !prev;
          if (next) {
            worldRef.current?.pauseGame();
          } else {
            worldRef.current?.resumeGame();
          }
          return next;
        });
      } else if (e.code === 'KeyM' && worldRef.current) {
        const phase = phaseRef.current;
        if (phase !== 'playing' && phase !== 'paused') return;
        worldRef.current.openStoryModal(null);
        setJournalOpen(false);
        setControlsOpen(false);
        setMapOpen((prev) => {
          const next = !prev;
          if (next) {
            worldRef.current?.pauseGame();
          } else {
            worldRef.current?.resumeGame();
          }
          return next;
        });
      } else if (e.code === 'KeyK' && worldRef.current) {
        const phase = phaseRef.current;
        if (phase !== 'playing' && phase !== 'paused') return;
        worldRef.current.openStoryModal(null);
        setJournalOpen(false);
        setMapOpen(false);
        setControlsOpen((prev) => {
          const next = !prev;
          if (next) {
            worldRef.current?.pauseGame();
          } else {
            worldRef.current?.resumeGame();
          }
          return next;
        });
      } else if (e.code === 'Escape' && (journalOpenRef.current || mapOpenRef.current || controlsOpenRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setJournalOpen(false);
        setMapOpen(false);
        setControlsOpen(false);
        worldRef.current?.resumeGame();
      } else if (e.code === 'KeyT') {
        setMuted((prev) => {
          const next = !prev;
          soundEngine.setMuted(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Mount WebGL PyramidWorld once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const isSoftwareGl = detectSoftwareWebGL();
    try {
      const world = new PyramidWorld(
        mount,
        (snapshot) => {
          setHud(snapshot);
        },
        isSoftwareGl,
      );
      worldRef.current = world;
      return () => {
        world.dispose();
        worldRef.current = null;
        soundEngine.dispose();
      };
    } catch {
      setWebglError(true);
    }
  }, []);

  const handleStart = useCallback(() => {
    worldRef.current?.startGame();
  }, []);

  const handleResume = useCallback(() => {
    setJournalOpen(false);
    setMapOpen(false);
    setControlsOpen(false);
    worldRef.current?.resumeGame();
  }, []);

  const handlePause = useCallback(() => {
    worldRef.current?.pauseGame();
  }, []);

  const handleRestart = useCallback(() => {
    setJournalOpen(false);
    setMapOpen(false);
    setControlsOpen(false);
    worldRef.current?.resetGame();
  }, []);

  const handleRespawnCheckpoint = useCallback(() => {
    setJournalOpen(false);
    setMapOpen(false);
    setControlsOpen(false);
    worldRef.current?.respawnAtCheckpoint();
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleOpenJournal = useCallback(() => {
    setMapOpen(false);
    setControlsOpen(false);
    setSelectedStoryId(null);
    setJournalOpen(true);
    worldRef.current?.pauseGame();
  }, []);

  const handleCloseJournal = useCallback(() => {
    setJournalOpen(false);
    worldRef.current?.openStoryModal(null);
    worldRef.current?.resumeGame();
  }, []);

  const handleOpenMap = useCallback(() => {
    worldRef.current?.openStoryModal(null);
    setJournalOpen(false);
    setControlsOpen(false);
    setMapOpen(true);
    worldRef.current?.pauseGame();
  }, []);

  const handleCloseMap = useCallback(() => {
    setMapOpen(false);
    worldRef.current?.resumeGame();
  }, []);

  const handleOpenControls = useCallback(() => {
    worldRef.current?.openStoryModal(null);
    setJournalOpen(false);
    setMapOpen(false);
    setControlsOpen(true);
    worldRef.current?.pauseGame();
  }, []);

  const handleCloseControls = useCallback(() => {
    setControlsOpen(false);
    worldRef.current?.resumeGame();
  }, []);

  const handleChangeSensitivity = useCallback((val: number) => {
    setSensitivity(val);
    worldRef.current?.setSensitivity(val);
  }, []);

  const handleToggleInvertY = useCallback(() => {
    setInvertY((prev) => {
      const next = !prev;
      worldRef.current?.setInvertY(next);
      return next;
    });
  }, []);

  const activeModalId = hud.activeStoryModalId;
  const showJournal = journalOpen || activeModalId !== null;
  const isAnyModalOpen = showJournal || mapOpen || controlsOpen;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0d0b09]">
      {/* Dedicated Isolated WebGL Mount Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Graceful Fallback if WebGL unavailable */}
      {webglError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#120e0a] p-6 text-center">
          <div className="max-w-md bg-[#1a150f] border border-[#d4a359]/30 rounded-xl p-6">
            <h1 className="font-display text-2xl font-bold text-[#f7efe0] mb-2">
              Geheimnis der Pyramiden
            </h1>
            <p className="text-sm text-[#cbb899]">
              WebGL konnte in diesem Browser nicht initialisiert werden. Bitte aktiviere die
              Hardware-Beschleunigung, um das 3D-Abenteuer zu starten.
            </p>
          </div>
        </div>
      )}

      {/* Semantic 2D Game HUD */}
      {!webglError && (
        <GameHud
          hud={hud}
          muted={muted}
          bestGold={bestGold}
          isModalOpen={isAnyModalOpen}
          showTouchPad={showTouchPad}
          onStart={handleStart}
          onResume={handleResume}
          onPause={handlePause}
          onRestart={handleRestart}
          onRespawnCheckpoint={handleRespawnCheckpoint}
          onToggleMute={handleToggleMute}
          onOpenJournal={handleOpenJournal}
          onOpenMap={handleOpenMap}
          onOpenControls={handleOpenControls}
          onTorchAttack={() => worldRef.current?.triggerTorchAttack()}
          onSolarFlash={() => worldRef.current?.triggerSolarFlash()}
          onInteract={() => worldRef.current?.triggerInteract()}
          onVirtualKey={(code, pressed) => worldRef.current?.setVirtualKey(code, pressed)}
        />
      )}

      {/* Expedition Story & Clues Modal */}
      {showJournal && (
        <StoryJournalModal
          unlockedIds={hud.unlockedStories}
          activeStoryId={activeModalId ?? selectedStoryId}
          onSelectStory={(id) => {
            setSelectedStoryId(id);
            if (activeModalId) {
              worldRef.current?.openStoryModal(id);
            }
          }}
          onClose={handleCloseJournal}
        />
      )}

      {/* Interactive Pyramid Fog-of-War Map Modal */}
      {mapOpen && <PyramidMapModal hud={hud} onClose={handleCloseMap} />}

      {/* Controls & Settings Modal */}
      {controlsOpen && (
        <ControlsModal
          sensitivity={sensitivity}
          invertY={invertY}
          showTouchPad={showTouchPad}
          onChangeSensitivity={handleChangeSensitivity}
          onToggleInvertY={handleToggleInvertY}
          onToggleTouchPad={() => setShowTouchPad((v) => !v)}
          onClose={handleCloseControls}
        />
      )}
    </main>
  );
}
