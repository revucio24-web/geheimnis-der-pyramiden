import React from 'react';
import { Gamepad2, X } from 'lucide-react';

interface ControlsModalProps {
  sensitivity: number;
  invertY: boolean;
  showTouchPad: boolean;
  onChangeSensitivity: (val: number) => void;
  onToggleInvertY: () => void;
  onToggleTouchPad: () => void;
  onClose: () => void;
}

const CONTROL_ROWS: { keys: string; action: string }[] = [
  { keys: 'W A S D / Pfeile', action: 'Vorwärts, rückwärts und seitwärts gehen' },
  { keys: 'Shift (links/rechts)', action: 'Sprinten (z. B. durch Pendel-Fallen)' },
  { keys: 'Leertaste', action: 'Springen (weicht auch Schockwellen aus)' },
  { keys: 'Maus / Ziehen / Touch', action: 'Umsehen (Klick ins 3D-Fenster oder Ziehen)' },
  { keys: 'E', action: 'Rätsel drehen, Steintafeln lesen, Schätze bergen' },
  { keys: 'Linksklick / F', action: 'Fackelschlag (Mumien, Tonkrüge, rissige Mauern)' },
  { keys: 'Q', action: 'Sonnenblitz (blendet nahe Mumien)' },
  { keys: 'M / J / K', action: 'Pyramidenkarte · Tagebuch · Steuerung' },
  { keys: 'T / H / Esc', action: 'Ton stumm · Leiste ein-/ausblenden · Pause' },
];

export const ControlsModal: React.FC<ControlsModalProps> = ({
  sensitivity,
  invertY,
  showTouchPad,
  onChangeSensitivity,
  onToggleInvertY,
  onToggleTouchPad,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#080604]/85"
      role="dialog"
      aria-modal="true"
      aria-label="Steuerung und Einstellungen"
    >
      <div className="w-full max-w-2xl bg-[#16120d] border border-[#d4a359]/30 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4a359]/20">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-5 h-5 text-[#d4a359]" />
            <h2 className="font-display text-lg font-semibold tracking-wide text-[#f4ead5]">
              Steuerung &amp; Einstellungen
            </h2>
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

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Interactive Controls Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#1c1610] border border-[#d4a359]/20 rounded-lg p-4">
            <div className="sm:col-span-1">
              <label
                htmlFor="mouse-sensitivity"
                className="block text-xs font-medium text-[#d8cbb4] mb-2"
              >
                Mausempfindlichkeit ({sensitivity.toFixed(1)}×)
              </label>
              <input
                id="mouse-sensitivity"
                type="range"
                min={0.4}
                max={2.2}
                step={0.1}
                value={sensitivity}
                onChange={(e) => onChangeSensitivity(Number(e.target.value))}
                className="w-full accent-[#d4a359] cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-3">
              <span className="text-xs font-medium text-[#d8cbb4]">Y-Achse umkehren</span>
              <button
                type="button"
                onClick={onToggleInvertY}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  invertY
                    ? 'bg-[#d4a359] text-[#140f0a] border-[#d4a359]'
                    : 'bg-[#241d15] text-[#cbb899] border-[#d4a359]/25 hover:text-white'
                }`}
              >
                {invertY ? 'Aktiv' : 'Aus'}
              </button>
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-3">
              <span className="text-xs font-medium text-[#d8cbb4]">Steuerkreuz-Pad</span>
              <button
                type="button"
                onClick={onToggleTouchPad}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  showTouchPad
                    ? 'bg-[#d4a359] text-[#140f0a] border-[#d4a359]'
                    : 'bg-[#241d15] text-[#cbb899] border-[#d4a359]/25 hover:text-white'
                }`}
              >
                {showTouchPad ? 'Sichtbar' : 'Aus'}
              </button>
            </div>
          </div>

          {/* Key Bindings Table */}
          <div className="divide-y divide-[#d4a359]/12 border border-[#d4a359]/20 rounded-lg overflow-hidden">
            {CONTROL_ROWS.map((row) => (
              <div
                key={row.keys}
                className="flex items-center justify-between gap-4 px-4 py-2.5 bg-[#14100b]"
              >
                <span className="font-mono-tabular text-xs font-semibold text-[#f0c674] whitespace-nowrap">
                  {row.keys}
                </span>
                <span className="text-xs sm:text-sm text-[#dfd3be] text-right">
                  {row.action}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
