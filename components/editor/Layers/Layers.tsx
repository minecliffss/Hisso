'use client';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useEditorStore } from '@/lib/store/editor';
import { cn } from '@/lib/utils/cn';
import type { Layer } from '@/types';

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-7.5 9.75-7.5S21.75 12 21.75 12 18 19.5 12 19.5 2.25 12 2.25 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 5.1A10.8 10.8 0 0 1 12 4.5C18 4.5 21.75 12 21.75 12a19.1 19.1 0 0 1-3.62 4.88" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.16 8.16A8.87 8.87 0 0 0 2.25 12S6 19.5 12 19.5a8.81 8.81 0 0 0 3.18-.59" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 2.12-.88" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function UnlockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V8a4 4 0 0 1 7.5-2" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V4h6v3" />
    </svg>
  );
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 14 6-6 6 6" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 10 6 6 6-6" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function layerColor(type: Layer['type']) {
  switch (type) {
    case 'image': return 'bg-purple-500';
    case 'text': return 'bg-emerald-500';
    case 'shape': return 'bg-blue-500';
    default: return 'bg-zinc-500';
  }
}

export function Layers() {
  const {
    layers,
    selectedLayerId,
    addLayer,
    deleteLayer,
    reorderLayers,
    toggleLayerVisibility,
    toggleLayerLock,
    setLayerOpacity,
    setSelectedLayerId,
  } = useEditorStore();

  const sortedLayers = [...layers].sort((a, b) => b.order - a.order);
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId) ?? null;
  const selectedIndex = selectedLayer ? layers.findIndex((layer) => layer.id === selectedLayer.id) : -1;

  const handleAddLayer = () => {
    addLayer({
      name: `Layer ${layers.length + 1}`,
      type: 'image',
    });
  };

  const handleMoveUp = () => {
    if (selectedIndex > 0) reorderLayers(selectedIndex, selectedIndex - 1);
  };

  const handleMoveDown = () => {
    if (selectedIndex >= 0 && selectedIndex < layers.length - 1) reorderLayers(selectedIndex, selectedIndex + 1);
  };

  return (
    <aside className="w-60 bg-zinc-900 border-l border-zinc-800 flex flex-col text-zinc-100">
      <div className="h-12 px-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-100">Layers</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleAddLayer}
          className="h-8 w-8 text-zinc-400 hover:text-white"
          aria-label="Add layer"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sortedLayers.length === 0 ? (
          <div className="px-3 py-4 text-xs text-zinc-500 text-center border border-dashed border-zinc-800 rounded-md">
            No layers yet
          </div>
        ) : (
          sortedLayers.map((layer) => {
            const isSelected = layer.id === selectedLayerId;
            return (
              <button
                key={layer.id}
                type="button"
                onClick={() => setSelectedLayerId(layer.id)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors border border-transparent',
                  isSelected ? 'bg-zinc-700 border-zinc-600' : 'hover:bg-zinc-800/80'
                )}
              >
                <div className={cn('h-8 w-8 rounded border border-zinc-700 shrink-0', layerColor(layer.type))} />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-100">{layer.name}</div>
                  <div className="text-[11px] uppercase tracking-wide text-zinc-500">{layer.type}</div>
                </div>

                <div className="flex items-center gap-1 text-zinc-400">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                    aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
                  >
                    {layer.visible ? <EyeIcon className="h-4 w-4" /> : <EyeOffIcon className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); toggleLayerLock(layer.id); }}
                    aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
                  >
                    {layer.locked ? <LockIcon className="h-4 w-4" /> : <UnlockIcon className="h-4 w-4" />}
                  </Button>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="border-t border-zinc-800 p-3 space-y-3 shrink-0 bg-zinc-900/95">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="destructive"
            size="icon"
            disabled={!selectedLayer}
            onClick={() => selectedLayer && deleteLayer(selectedLayer.id)}
            aria-label="Delete layer"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
          <div className="flex-1 flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              disabled={selectedIndex <= 0}
              onClick={handleMoveUp}
              aria-label="Move layer up"
            >
              <ChevronUpIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              disabled={selectedIndex < 0 || selectedIndex >= layers.length - 1}
              onClick={handleMoveDown}
              aria-label="Move layer down"
            >
              <ChevronDownIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Opacity</span>
            <span>{selectedLayer ? Math.round(selectedLayer.opacity * 100) : 0}%</span>
          </div>
          <Slider
            label={selectedLayer ? selectedLayer.name : undefined}
            value={selectedLayer ? Math.round(selectedLayer.opacity * 100) : 0}
            min={0}
            max={100}
            step={1}
            onChange={(value) => {
              if (selectedLayer) setLayerOpacity(selectedLayer.id, value / 100);
            }}
          />
        </div>
      </div>
    </aside>
  );
}
