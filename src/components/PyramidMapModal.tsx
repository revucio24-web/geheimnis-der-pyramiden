import React from 'react';
import { Compass, Map as MapIcon, X } from 'lucide-react';
import { ZONE_NAMES } from '../game/story';
import { HudSnapshot, ZoneId } from '../game/types';

interface PyramidMapModalProps {
  hud: HudSnapshot;
  onClose: () => void;
}

interface ChamberRect {
  id: ZoneId;
  label: string;
  x: number;
  z: number;
  w: number;
  h: number;
  isSecret?: boolean;
  secretUnlocked?: boolean;
}

export const PyramidMapModal: React.FC<PyramidMapModalProps> = ({ hud, onClose }) => {
  const visited = new Set(hud.visitedZones);

  const chambers: ChamberRect[] = [
    { id: 'sanctum', label: 'Grabkammer', x: -13.3, z: -88.3, w: 26.6, h: 26.3 },
    { id: 'catacombs', label: 'Katakomben', x: -14.3, z: -62.0, w: 28.6, h: 28.0 },
    {
      id: 'secret_catacombs',
      label: 'Nische',
      x: -20.6,
      z: -59.6,
      w: 6.3,
      h: 6.2,
      isSecret: true,
      secretUnlocked: hud.secret2Opened,
    },
    { id: 'trap_corridor', label: 'Passage', x: -3.45, z: -34.0, w: 6.9, h: 24.0 },
    {
      id: 'secret_alcove',
      label: 'Wesir',
      x: 3.45,
      z: -26.2,
      w: 7.25,
      h: 8.4,
      isSecret: true,
      secretUnlocked: hud.secret1Opened,
    },
    { id: 'entrance_hall', label: 'Vorhalle', x: -9.3, z: -10.0, w: 18.6, h: 20.0 },
    { id: 'forecourt', label: 'Vorhof', x: -10.4, z: 10.0, w: 20.8, h: 16.5 },
  ];

  const playerDeg = (-hud.playerYaw * 180) / Math.PI;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#080604]/85"
      role="dialog"
      aria-modal="true"
      aria-label="Karte der Pyramide"
    >
      <div className="w-full max-w-3xl bg-[#16120d] border border-[#d4a359]/30 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4a359]/20">
          <div className="flex items-center gap-3">
            <MapIcon className="w-5 h-5 text-[#d4a359]" />
            <div>
              <h2 className="font-display text-lg font-semibold tracking-wide text-[#f4ead5]">
                Grundriss der Pyramide von Chnum-Re
              </h2>
              <p className="text-xs text-[#b5a385]">
                Aktueller Ort: {hud.zoneName} · Geheimkammern: {hud.secretsFound}/{hud.totalSecrets}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium text-[#d8cbb4] hover:text-white bg-[#241d15] hover:bg-[#33281d] border border-[#d4a359]/20 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Schließen</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Top-Down Architectural SVG Map */}
          <div className="md:col-span-7 bg-[#0f0c08] border border-[#d4a359]/20 rounded-lg p-3 flex items-center justify-center">
            <svg
              viewBox="-24 -92 44 122"
              className="w-full max-h-[54vh] select-none"
              aria-label="Grundrisskarte der Pyramide"
            >
              {/* Compass North Indicator */}
              <g transform="translate(15, -86)">
                <text
                  x="0"
                  y="0"
                  textAnchor="middle"
                  fill="#d4a359"
                  fontSize="3.2"
                  fontWeight="bold"
                >
                  N
                </text>
                <path d="M0,-4.8 L1.2,-2.4 L-1.2,-2.4 Z" fill="#d4a359" />
              </g>

              {/* Chambers (Fog of War for unvisited, hidden for undiscovered secrets) */}
              {chambers.map((c) => {
                if (c.isSecret && !c.secretUnlocked && !visited.has(c.id)) {
                  return null;
                }
                const isVisited = visited.has(c.id);
                const isCurrent = hud.zoneId === c.id;
                return (
                  <g key={c.id}>
                    <rect
                      x={c.x}
                      y={c.z}
                      width={c.w}
                      height={c.h}
                      fill={
                        isCurrent
                          ? '#2f2416'
                          : isVisited
                            ? '#1f1810'
                            : '#120f0b'
                      }
                      stroke={
                        isCurrent
                          ? '#f5c76b'
                          : isVisited
                            ? '#9a753d'
                            : '#3a2e1e'
                      }
                      strokeWidth={isCurrent ? 0.55 : 0.35}
                      strokeDasharray={!isVisited ? '1.2 1.2' : undefined}
                      rx={0.5}
                    />
                    <text
                      x={c.x + c.w / 2}
                      y={c.z + c.h / 2 + 0.9}
                      textAnchor="middle"
                      fill={isVisited ? '#dfd1b6' : '#5e4f3a'}
                      fontSize={c.isSecret ? '2.1' : '2.7'}
                    >
                      {isVisited ? c.label : '???'}
                    </text>
                  </g>
                );
              })}

              {/* Catacombs Chasm & Bridge of Osiris (only once catacombs visited) */}
              {visited.has('catacombs') && (
                <g>
                  <rect x={-14.0} y={-51.0} width={28.0} height={6.0} fill="#090705" opacity={0.85} />
                  <rect
                    x={-2.2}
                    y={-51.1}
                    width={4.4}
                    height={6.2}
                    fill={hud.puzzle2Solved ? '#d4a359' : '#3a2a18'}
                    stroke={hud.puzzle2Solved ? '#ffe39c' : '#6e4e2a'}
                    strokeWidth={0.25}
                  />
                </g>
              )}

              {/* Gate 1 (z = -10) */}
              <line
                x1={-2.3}
                y1={-10}
                x2={2.3}
                y2={-10}
                stroke={hud.puzzle1Solved ? '#34d399' : '#e05252'}
                strokeWidth={0.8}
              />

              {/* Gate 2 (z = -62) */}
              {visited.has('catacombs') && (
                <line
                  x1={-2.3}
                  y1={-62}
                  x2={2.3}
                  y2={-62}
                  stroke={hud.puzzle2Solved ? '#34d399' : '#e05252'}
                  strokeWidth={0.8}
                />
              )}

              {/* Sanctum Sarcophagus & Crown Marker */}
              {visited.has('sanctum') && (
                <g>
                  <rect
                    x={-1.8}
                    y={-78.6}
                    width={3.6}
                    height={5.2}
                    fill="#d4a359"
                    opacity={0.75}
                    rx={0.3}
                  />
                  <circle
                    cx={0}
                    cy={-83.0}
                    r={1.3}
                    fill={hud.puzzle3MirrorsAligned ? '#34d399' : '#f59e0b'}
                  />
                </g>
              )}

              {/* Live Player Arrow Marker */}
              <g transform={`translate(${hud.playerX}, ${hud.playerZ}) rotate(${playerDeg})`}>
                <circle r={2.1} fill="#d4a359" opacity={0.24} />
                <polygon
                  points="0,-2.0 1.4,1.5 0,0.7 -1.4,1.5"
                  fill="#ffd275"
                  stroke="#140f0a"
                  strokeWidth={0.35}
                />
              </g>
            </svg>
          </div>

          {/* Legend & Live Expedition Details */}
          <div className="md:col-span-5 space-y-4">
            <div className="bg-[#1c1610] border border-[#d4a359]/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#d4a359] mb-1.5">
                <Compass className="w-4 h-4" />
                <span>Aktuelles Ziel</span>
              </div>
              <p className="text-sm leading-relaxed text-[#f0e4cd]">{hud.objectiveText}</p>
            </div>

            <div className="bg-[#1c1610] border border-[#d4a359]/20 rounded-lg p-4 space-y-2.5 text-xs text-[#d6c6ab]">
              <div className="font-semibold text-[#f2e5ce] mb-1">Entdeckte Kammern</div>
              {(
                [
                  'forecourt',
                  'entrance_hall',
                  'trap_corridor',
                  'secret_alcove',
                  'catacombs',
                  'secret_catacombs',
                  'sanctum',
                ] as ZoneId[]
              ).map((zId) => {
                const isSecret = zId === 'secret_alcove' || zId === 'secret_catacombs';
                const secretUnlocked =
                  zId === 'secret_alcove'
                    ? hud.secret1Opened
                    : zId === 'secret_catacombs'
                      ? hud.secret2Opened
                      : false;
                const found = visited.has(zId);
                if (isSecret && !found) {
                  return (
                    <div key={zId} className="flex items-center justify-between text-[#7a6950]">
                      <span className={secretUnlocked ? 'text-[#d4a359]' : undefined}>
                        {secretUnlocked ? 'Geheimkammer (geöffnet)' : 'Verborgene Kammer'}
                      </span>
                      <span className={secretUnlocked ? 'text-[#d4a359]' : undefined}>
                        {secretUnlocked ? 'Offen' : 'Unentdeckt'}
                      </span>
                    </div>
                  );
                }
                return (
                  <div key={zId} className="flex items-center justify-between gap-2">
                    <span className={hud.zoneId === zId ? 'text-[#f5c76b] font-semibold' : found ? 'text-[#e2d4bc]' : 'text-[#7a6950]'}>
                      {found ? ZONE_NAMES[zId] : 'Unerforschter Bereich'}
                    </span>
                    <span className="font-mono-tabular text-[11px] text-[#a99677]">
                      {hud.zoneId === zId ? 'Hier' : found ? 'Erkundet' : '—'}
                    </span>
                  </div>
                );
              })}
            </div>

            {hud.hasCheckpoint && (
              <div className="text-xs text-[#cbb899] bg-[#14100b] border border-[#d4a359]/20 rounded-lg px-4 py-2.5">
                Letzter Kontrollpunkt: <span className="text-[#f5c76b] font-medium">{hud.checkpointZoneName}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
