import React from 'react';
import { BookOpen, X } from 'lucide-react';
import { STORY_ENTRIES } from '../game/story';

interface StoryJournalModalProps {
  unlockedIds: string[];
  activeStoryId: string | null;
  onSelectStory: (id: string) => void;
  onClose: () => void;
}

export const StoryJournalModal: React.FC<StoryJournalModalProps> = ({
  unlockedIds,
  activeStoryId,
  onSelectStory,
  onClose,
}) => {
  const selectedId = activeStoryId && unlockedIds.includes(activeStoryId) ? activeStoryId : unlockedIds[unlockedIds.length - 1] ?? 'prologue';
  const activeEntry = STORY_ENTRIES.find((s) => s.id === selectedId) ?? STORY_ENTRIES[0];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#080604]/85"
      role="dialog"
      aria-modal="true"
      aria-label="Expeditionstagebuch"
    >
      <div className="w-full max-w-3xl bg-[#16120d] border border-[#d4a359]/30 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4a359]/20">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-[#d4a359]" />
            <h2 className="font-display text-lg font-semibold tracking-wide text-[#f4ead5]">
              Expeditionstagebuch der Pyramide
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

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0">
          {/* Chapter List */}
          <div className="md:col-span-5 border-b md:border-b-0 md:border-r border-[#d4a359]/15 p-4 space-y-2 overflow-y-auto bg-[#120e0a]">
            {STORY_ENTRIES.map((entry) => {
              const unlocked = unlockedIds.includes(entry.id);
              const isSelected = entry.id === activeEntry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => unlocked && onSelectStory(entry.id)}
                  className={`w-full text-left px-3.5 py-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-[#2a2117] border-[#d4a359]/60 text-[#f7efe0]'
                      : unlocked
                        ? 'bg-[#1a150f] border-[#d4a359]/15 text-[#cbbba0] hover:bg-[#231c14] cursor-pointer'
                        : 'bg-[#120e0a] border-[#d4a359]/5 text-[#665b4b] cursor-not-allowed'
                  }`}
                >
                  <div className="text-xs text-[#a88e62] mb-0.5 font-mono-tabular">
                    Kapitel {entry.chapter}
                  </div>
                  <div className="text-sm font-semibold leading-snug">
                    {unlocked ? entry.title : 'Unentdeckte Steintafel'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Reading Pane */}
          <div className="md:col-span-7 p-6 overflow-y-auto flex flex-col justify-between gap-6">
            <div>
              <div className="text-xs text-[#d4a359] tracking-wide mb-2">
                {activeEntry.subtitle}
              </div>
              <h3 className="font-display text-2xl font-semibold text-[#f7efe0] mb-4">
                {activeEntry.title}
              </h3>
              <p className="text-[15px] leading-relaxed text-[#dfd3be] whitespace-pre-line">
                {activeEntry.text}
              </p>
            </div>

            {activeEntry.clue && (
              <div className="p-4 rounded-lg bg-[#211a12] border border-[#d4a359]/30">
                <div className="text-xs font-semibold text-[#d4a359] mb-1">
                  Archäologischer Hinweis
                </div>
                <p className="text-sm leading-relaxed text-[#f0e3cc]">
                  {activeEntry.clue}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
