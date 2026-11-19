import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Compass,
  Flame,
  Gamepad2,
  Heart,
  Map as MapIcon,
  Pause,
  Play,
  RotateCcw,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  bestGold: number;
  isModalOpen: boolean;
  showTouchPad: boolean;
  onStart: () => void;
  onResume: () => void;
  onPause: () => void;
  onRestart: () => void;
  onRespawnCheckpoint: () => void;
  onToggleMute: () => void;
  onOpenJournal: () => void;
  onOpenMap: () => void;
  onOpenControls: () => void;
  onTorchAttack: () => void;
  onSolarFlash: () => void;
  onInteract: () => void;
  onVirtualKey: (code: string, pressed: boolean) => void;
}

function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const COMPASS_LABELS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'] as const;

function getCompassLabel(yawRad: number): string {
  const deg = (((-yawRad * 180) / Math.PI) % 360 + 360) % 360;
  const idx = Math.round(deg / 45) % 8;
  return COMPASS_LABELS[idx];
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  muted,
  bestGold,
  isModalOpen,
  showTouchPad,
  onStart,
  onResume,
  onPause,
  onRestart,
  onRespawnCheckpoint,
  onToggleMute,
  onOpenJournal,
  onOpenMap,
  onOpenControls,
  onTorchAttack,
  onSolarFlash,
  onInteract,
  onVirtualKey,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH' && hud.phase !== 'title' && !isModalOpen) {
        setDockCollapsed((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hud.phase, isModalOpen]);

  const isPlaying = hud.phase === 'playing';

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between">
      {/* Subtle Hurt Vignette Flash */}
      {hud.hurtFlash > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle, transparent 48%, rgba(185, 28, 28, ${Math.min(0.55, hud.hurtFlash * 0.55)}) 100%)`,
          }}
        />
      )}

      {/* TOP BAR (Minimal, unobstructed center, zero pills, zero backdrop-blur) */}
      <header className="w-full px-5 pt-4 flex items-start justify-between gap-4">
        {/* Top-Left: Title, Current Chamber, Compass & Current Objective */}
        <div className="bg-[#120e0a]/90 border border-[#d4a359]/25 rounded-lg px-4 py-2.5 pointer-events-auto max-w-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-display text-sm font-semibold tracking-wide text-[#f2e5ce] whitespace-nowrap">
              Geheimnis der Pyramiden
            </span>
            {hud.phase !== 'title' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono-tabular font-semibold text-[#f5c76b] shrink-0">
                <Compass className="w-3.5 h-3.5" />
                <span>{getCompassLabel(hud.playerYaw)}</span>
              </span>
            )}
          </div>
          <div className="text-xs text-[#cbb899] mt-0.5 flex items-center gap-2 whitespace-nowrap">
            <span>{hud.zoneName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{formatTime(hud.elapsedSeconds)}</span>
          </div>
          {isPlaying && (
            <div className="text-[11px] text-[#e6d5b8]/90 mt-1.5 pt-1.5 border-t border-[#d4a359]/15 leading-snug">
              {hud.objectiveText}
            </div>
          )}
        </div>

        {/* Top-Right: Core Expedition Metrics */}
        {hud.phase !== 'title' && (
          <div className="bg-[#120e0a]/90 border border-[#d4a359]/25 rounded-lg px-4 py-2.5 flex items-center gap-5 pointer-events-auto">
            {/* Health */}
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-[#e05252] shrink-0" />
              <div>
                <div className="text-[11px] text-[#b4a387] leading-none mb-1">Lebenskraft</div>
                <div className="w-24 h-1.5 bg-[#2a2118] rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-[#e05252] transition-all duration-150"
                    style={{ width: `${Math.max(0, (hud.health / hud.maxHealth) * 100)}%` }}
                  />
                </div>
              </div>
              <span className="font-mono-tabular text-xs font-semibold text-[#f2e5ce] w-7 text-right">
                {hud.health}
              </span>
            </div>

            {/* Solar Energy */}
            <div className="hidden sm:flex items-center gap-2">
              <Sun className="w-4 h-4 text-[#f5b942] shrink-0" />
              <div>
                <div className="text-[11px] text-[#b4a387] leading-none mb-1">Sonnenlicht</div>
                <div className="w-20 h-1.5 bg-[#2a2118] rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-[#f5b942] transition-all duration-150"
                    style={{ width: `${Math.max(0, (hud.solarEnergy / hud.maxSolarEnergy) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Clean unboxed stats */}
            <div className="hidden md:flex items-center gap-3 text-xs text-[#e5d6bd] border-l border-[#d4a359]/20 pl-4 font-mono-tabular whitespace-nowrap">
              <span>Gold: {hud.gold}</span>
              <span aria-hidden="true" className="text-[#8e7a5a]">·</span>
              <span>
                Schätze: {hud.treasuresFound}/{hud.totalTreasures}
              </span>
              <span aria-hidden="true" className="text-[#8e7a5a]">·</span>
              <span>
                Rätsel: {hud.puzzlesSolved}/{hud.totalPuzzles}
              </span>
            </div>
          </div>
        )}
      </header>

      {/* CENTER VIEWPORT OVERLAYS (Crosshair, Boss Bar, Banners, Modals) */}
      <div className="flex-1 relative overflow-y-auto">
        {/* Boss Health Bar in Sanctum */}
        {isPlaying && hud.bossHealthRatio !== null && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#140f0a]/90 border border-[#d4a359]/35 rounded-lg px-5 py-2.5 min-w-[280px]">
            <div className="flex items-center justify-between text-xs text-[#f2e5ce] mb-1.5">
              <span className="font-display font-semibold tracking-wide">Wächter-Pharao Imhotep</span>
              <span className="font-mono-tabular text-[#d4a359]">
                {Math.round(hud.bossHealthRatio * 100)}%
              </span>
            </div>
            <div className="w-full h-2 bg-[#2b2117] rounded-sm overflow-hidden">
              <div
                className="h-full bg-[#d4a359] transition-all duration-150"
                style={{ width: `${hud.bossHealthRatio * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Active Targeted Normal Mummy Health Bar */}
        {isPlaying && hud.bossHealthRatio === null && hud.targetedMummy && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#140f0a]/90 border border-[#e05252]/35 rounded-lg px-4 py-2 min-w-[220px]">
            <div className="flex items-center justify-between text-xs text-[#f2e5ce] mb-1">
              <span className="font-medium">{hud.targetedMummy.name}</span>
              <span className="font-mono-tabular text-[#e05252]">
                {Math.round(hud.targetedMummy.healthRatio * 100)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#2b2117] rounded-sm overflow-hidden">
              <div
                className="h-full bg-[#e05252] transition-all duration-150"
                style={{ width: `${hud.targetedMummy.healthRatio * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Story / Discovery Banner */}
        {isPlaying && hud.bannerMessage && (
          <div
            className={`absolute left-1/2 -translate-x-1/2 max-w-xl bg-[#16120c]/95 border border-[#d4a359]/50 rounded-lg px-5 py-2.5 text-center shadow-lg ${
              hud.bossHealthRatio !== null || hud.targetedMummy ? 'top-20' : 'top-8'
            }`}
          >
            <p className="text-sm font-medium text-[#f5e7ce]">{hud.bannerMessage}</p>
          </div>
        )}

        {/* Scroll-safe centering wrapper: on short viewports tall cards (title,
            victory) overflow vertically and stay scrollable instead of being
            clipped by the page's overflow:hidden. Absolute HUD overlays above
            remain pinned to the viewport area. */}
        <div className="min-h-full w-full flex items-center justify-center p-4">
        {/* Minimal Center Crosshair + Interaction Prompt */}
        {isPlaying && !hud.activeStoryModalId && (
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full border border-[#f5e6c8]/80 bg-[#d4a359]/50" />
            {hud.interactPrompt && (
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onInteract();
                }}
                className="mt-5 px-4 py-1.5 rounded-lg bg-[#16120c]/95 border border-[#d4a359]/55 text-sm font-medium text-[#f7ebd4] pointer-events-auto hover:bg-[#261f16] transition-colors cursor-pointer whitespace-nowrap"
              >
                {hud.interactPrompt}
              </button>
            )}
          </div>
        )}

        {/* TITLE SCREEN */}
        {hud.phase === 'title' && (
          <div className="pointer-events-auto max-w-xl w-[92vw] bg-[#14100b]/92 border border-[#d4a359]/35 rounded-xl p-8 shadow-2xl">
            <div className="text-xs text-[#d4a359] tracking-wide mb-2">
              3D-Abenteuerspiel · Sakkara-Expedition
            </div>
            <h1
              className="font-display text-3xl sm:text-4xl font-bold text-[#f7efe0] leading-tight mb-4"
              style={{ textWrap: 'balance' }}
            >
              Geheimnis der Pyramiden
            </h1>
            <p className="text-[15px] leading-relaxed text-[#d9cbb3] mb-6">
              Betritt das versiegelte Grabmal des vergessenen Pharaos Chnum-Re. Entschlüssele uralte
              Hieroglyphen-Rätsel, weiche tödlichen Speer- und Klingenfallen aus, finde verborgene
              Schätze und stelle dich den erwachten Mumien im Allerheiligsten.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs text-[#cbb99c] bg-[#1c1610] border border-[#d4a359]/15 rounded-lg p-4 mb-6">
              <div>
                <span className="text-[#f2e5ce] font-semibold">WASD / Pfeile:</span> Bewegen
              </div>
              <div>
                <span className="text-[#f2e5ce] font-semibold">Maus / Ziehen:</span> Umsehen
              </div>
              <div>
                <span className="text-[#f2e5ce] font-semibold">E:</span> Rätsel &amp; Schätze nutzen
              </div>
              <div>
                <span className="text-[#f2e5ce] font-semibold">Klick / F:</span> Fackelschlag
              </div>
              <div>
                <span className="text-[#f2e5ce] font-semibold">Q:</span> Sonnenblitz (Betäubung)
              </div>
              <div>
                <span className="text-[#f2e5ce] font-semibold">Shift / Leertaste:</span> Sprint / Sprung
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={onStart}
                className="px-6 py-3 rounded-lg bg-[#d4a359] hover:bg-[#e1b36b] text-[#140f0a] font-semibold text-sm transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Expedition starten</span>
              </button>

              {bestGold > 0 && (
                <div className="text-xs text-[#cbb899] font-mono-tabular">
                  Rekordbeute: {bestGold} Gold
                </div>
              )}
            </div>
          </div>
        )}

        {/* PAUSE SCREEN */}
        {hud.phase === 'paused' && !isModalOpen && (
          <div className="pointer-events-auto max-w-md w-[90vw] bg-[#14100b]/95 border border-[#d4a359]/35 rounded-xl p-7 shadow-2xl">
            <h2 className="font-display text-2xl font-semibold text-[#f7efe0] mb-2">
              Expedition pausiert
            </h2>
            <p className="text-sm text-[#cbb899] mb-6">
              Aktueller Ort: {hud.zoneName} · Schätze: {hud.treasuresFound}/{hud.totalTreasures}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onResume}
                className="px-5 py-2.5 rounded-lg bg-[#d4a359] hover:bg-[#e1b36b] text-[#140f0a] font-semibold text-sm transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Fortsetzen</span>
              </button>
              <button
                type="button"
                onClick={onOpenMap}
                className="px-4 py-2.5 rounded-lg bg-[#241d15] hover:bg-[#32281d] border border-[#d4a359]/25 text-[#f2e5ce] font-medium text-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                Karte
              </button>
              <button
                type="button"
                onClick={onOpenControls}
                className="px-4 py-2.5 rounded-lg bg-[#241d15] hover:bg-[#32281d] border border-[#d4a359]/25 text-[#f2e5ce] font-medium text-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                Steuerung
              </button>
              <button
                type="button"
                onClick={onOpenJournal}
                className="px-4 py-2.5 rounded-lg bg-[#241d15] hover:bg-[#32281d] border border-[#d4a359]/25 text-[#f2e5ce] font-medium text-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                Tagebuch
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="px-4 py-2.5 rounded-lg bg-[#241d15] hover:bg-[#32281d] border border-[#d4a359]/25 text-[#f2e5ce] font-medium text-sm transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Neu starten</span>
              </button>
            </div>
          </div>
        )}

        {/* VICTORY SCREEN */}
        {hud.phase === 'victory' && (
          <div className="pointer-events-auto max-w-lg w-[92vw] bg-[#14100b]/96 border border-[#d4a359]/50 rounded-xl p-8 shadow-2xl">
            <div className="text-xs text-[#d4a359] mb-1">Geheimnis gelüftet</div>
            <h2 className="font-display text-3xl font-bold text-[#f7efe0] mb-3">
              Die Krone der Ewigkeit
            </h2>
            <p className="text-sm leading-relaxed text-[#dfd3be] mb-6">
              Mit vereintem Sonnenlicht hast du den Fluch von Hohepriester Seti gebrochen und die
              Krone des Pharaos Chnum-Re geborgen. Die Geschichte des vergessenen Sonnenkönigs kehrt
              ins Licht zurück.
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm bg-[#1c1610] border border-[#d4a359]/20 rounded-lg p-4 mb-6 font-mono-tabular">
              <div>Gold gesammelt: <span className="text-[#f5c76b] font-semibold">{hud.gold}</span></div>
              <div>Schätze: <span className="text-[#f5c76b] font-semibold">{hud.treasuresFound}/{hud.totalTreasures}</span></div>
              <div>Geheimkammern: <span className="text-[#f5c76b] font-semibold">{hud.secretsFound}/{hud.totalSecrets}</span></div>
              <div>Zeit: <span className="text-[#f5c76b] font-semibold">{formatTime(hud.elapsedSeconds)}</span></div>
            </div>
            <button
              type="button"
              onClick={onRestart}
              className="px-6 py-3 rounded-lg bg-[#d4a359] hover:bg-[#e1b36b] text-[#140f0a] font-semibold text-sm transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Erneut spielen</span>
            </button>
          </div>
        )}

        {/* GAME OVER SCREEN */}
        {hud.phase === 'gameover' && (
          <div className="pointer-events-auto max-w-md w-[90vw] bg-[#14100b]/96 border border-[#e05252]/40 rounded-xl p-8 shadow-2xl">
            <div className="text-xs text-[#e05252] mb-1">Expedition gescheitert</div>
            <h2 className="font-display text-2xl font-bold text-[#f7efe0] mb-3">
              In den Schatten der Pyramide gefallen
            </h2>
            <p className="text-sm text-[#cbb899] mb-6">
              {hud.hasCheckpoint
                ? `Die Fallen und Wächter haben dich bezwungen. Du kannst am letzten Kontrollpunkt (${hud.checkpointZoneName}) wieder ansetzen.`
                : 'Die Fallen und Wächter der Pyramide haben dich bezwungen. Wage einen neuen Vorstoß mit deinem Wissen über die Kammern.'}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {hud.hasCheckpoint && (
                <button
                  type="button"
                  onClick={onRespawnCheckpoint}
                  className="px-5 py-3 rounded-lg bg-[#d4a359] hover:bg-[#e1b36b] text-[#140f0a] font-semibold text-sm transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Vom Kontrollpunkt</span>
                </button>
              )}
              <button
                type="button"
                onClick={onRestart}
                className={`px-5 py-3 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  hud.hasCheckpoint
                    ? 'bg-[#241d15] hover:bg-[#32281d] border border-[#d4a359]/25 text-[#f2e5ce]'
                    : 'bg-[#d4a359] hover:bg-[#e1b36b] text-[#140f0a]'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>{hud.hasCheckpoint ? 'Komplett neu' : 'Neu versuchen'}</span>
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* OPTIONAL ON-SCREEN DIRECTIONAL PAD (Bottom-Left) */}
      {isPlaying && showTouchPad && !isModalOpen && (
        <div className="fixed bottom-24 left-5 z-30 pointer-events-auto touch-none select-none grid grid-cols-3 gap-1.5 bg-[#14100b]/90 border border-[#d4a359]/25 rounded-xl p-2 shadow-xl">
          <div />
          <button
            type="button"
            aria-label="Vorwärts"
            onPointerDown={() => onVirtualKey('KeyW', true)}
            onPointerUp={() => onVirtualKey('KeyW', false)}
            onPointerLeave={() => onVirtualKey('KeyW', false)}
            onPointerCancel={() => onVirtualKey('KeyW', false)}
            className="w-11 h-11 rounded-lg bg-[#241d15] active:bg-[#d4a359] active:text-[#140f0a] border border-[#d4a359]/25 flex items-center justify-center text-[#f2e5ce] cursor-pointer"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
          <div />
          <button
            type="button"
            aria-label="Links"
            onPointerDown={() => onVirtualKey('KeyA', true)}
            onPointerUp={() => onVirtualKey('KeyA', false)}
            onPointerLeave={() => onVirtualKey('KeyA', false)}
            onPointerCancel={() => onVirtualKey('KeyA', false)}
            className="w-11 h-11 rounded-lg bg-[#241d15] active:bg-[#d4a359] active:text-[#140f0a] border border-[#d4a359]/25 flex items-center justify-center text-[#f2e5ce] cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Springen"
            onPointerDown={() => onVirtualKey('Space', true)}
            className="w-11 h-11 rounded-lg bg-[#2c2319] active:bg-[#d4a359] active:text-[#140f0a] border border-[#d4a359]/35 text-[10px] font-semibold text-[#f5c76b] flex items-center justify-center cursor-pointer"
          >
            Sprung
          </button>
          <button
            type="button"
            aria-label="Rechts"
            onPointerDown={() => onVirtualKey('KeyD', true)}
            onPointerUp={() => onVirtualKey('KeyD', false)}
            onPointerLeave={() => onVirtualKey('KeyD', false)}
            onPointerCancel={() => onVirtualKey('KeyD', false)}
            className="w-11 h-11 rounded-lg bg-[#241d15] active:bg-[#d4a359] active:text-[#140f0a] border border-[#d4a359]/25 flex items-center justify-center text-[#f2e5ce] cursor-pointer"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div />
          <button
            type="button"
            aria-label="Rückwärts"
            onPointerDown={() => onVirtualKey('KeyS', true)}
            onPointerUp={() => onVirtualKey('KeyS', false)}
            onPointerLeave={() => onVirtualKey('KeyS', false)}
            onPointerCancel={() => onVirtualKey('KeyS', false)}
            className="w-11 h-11 rounded-lg bg-[#241d15] active:bg-[#d4a359] active:text-[#140f0a] border border-[#d4a359]/25 flex items-center justify-center text-[#f2e5ce] cursor-pointer"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
          <div />
        </div>
      )}

      {/* COLLAPSIBLE BOTTOM CONTROL DOCK — only while playing/paused; in
          victory/gameover its action buttons would be dead (M2 audit fix). */}
      {(hud.phase === 'playing' || hud.phase === 'paused') && (
        <div className="w-full flex flex-col items-center pb-4 px-4 pointer-events-none">
          {isPlaying && !hud.pointerLocked && !dockCollapsed && (
            <div className="mb-1.5 text-[11px] text-[#cbb899]/90 bg-[#120e0a]/85 px-3 py-1 rounded border border-[#d4a359]/20">
              Klicke ins 3D-Fenster für Maussteuerung oder ziehe mit gedrückter Maustaste
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              setDockCollapsed((v) => !v);
            }}
            className="pointer-events-auto mb-1.5 px-3 py-1 rounded-t-md bg-[#16120c]/95 border border-b-0 border-[#d4a359]/25 text-[11px] font-medium text-[#cbb899] hover:text-white flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{dockCollapsed ? 'Steuerung anzeigen' : 'Steuerung verbergen'}</span>
          </button>

          {!dockCollapsed && (
            <div className="pointer-events-auto max-w-[min(960px,95vw)] bg-[#14100b]/94 border border-[#d4a359]/25 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-center gap-2.5 shadow-xl">
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onTorchAttack();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#241d15] hover:bg-[#33291d] border border-[#d4a359]/20 text-xs font-medium text-[#f2e5ce] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Flame className="w-3.5 h-3.5 text-[#ff9f45]" />
                <span>Fackelschlag (F)</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSolarFlash();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#241d15] hover:bg-[#33291d] border border-[#d4a359]/20 text-xs font-medium text-[#f2e5ce] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Sun className="w-3.5 h-3.5 text-[#f5b942]" />
                <span>Sonnenblitz (Q)</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenMap();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#241d15] hover:bg-[#33291d] border border-[#d4a359]/20 text-xs font-medium text-[#f2e5ce] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <MapIcon className="w-3.5 h-3.5 text-[#d4a359]" />
                <span>Karte (M)</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenJournal();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#241d15] hover:bg-[#33291d] border border-[#d4a359]/20 text-xs font-medium text-[#f2e5ce] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#d4a359]" />
                <span>Tagebuch ({hud.unlockedStories.length}/5)</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenControls();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#241d15] hover:bg-[#33291d] border border-[#d4a359]/20 text-xs font-medium text-[#f2e5ce] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Gamepad2 className="w-3.5 h-3.5 text-[#d4a359]" />
                <span>Steuerung (K)</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#241d15] hover:bg-[#33291d] border border-[#d4a359]/20 text-xs font-medium text-[#f2e5ce] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                {muted ? <VolumeX className="w-3.5 h-3.5 text-[#b4a387]" /> : <Volume2 className="w-3.5 h-3.5 text-[#d4a359]" />}
                <span>{muted ? 'Ton aus' : 'Ton an'}</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  if (hud.phase === 'playing') onPause();
                  else onResume();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#241d15] hover:bg-[#33291d] border border-[#d4a359]/20 text-xs font-medium text-[#f2e5ce] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5 text-[#cbb899]" />
                <span>{hud.phase === 'playing' ? 'Pause (Esc)' : 'Fortsetzen'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
