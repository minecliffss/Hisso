'use client';

import { useEditorStore } from '@/lib/store/editor';
import { cn } from '@/lib/utils/cn';

function capitalizeToolName(tool: string) {
  return tool
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function StatusBar() {
  const { activeTool, canvasWidth, canvasHeight, zoom, showGrid, layers } = useEditorStore();

  return (
    <div
      className={cn(
        'h-7 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between px-3 text-xs text-zinc-400'
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="truncate font-medium text-zinc-300">
          {capitalizeToolName(activeTool)}
        </span>
        <span className="whitespace-nowrap">{canvasWidth} × {canvasHeight}</span>
      </div>

      <div className="flex items-center gap-3 whitespace-nowrap">
        <button
          type="button"
          className="hover:text-zinc-200 transition-colors"
          onClick={() => useEditorStore.getState().zoomOut()}
        >
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="hover:text-zinc-200 transition-colors"
          onClick={() => useEditorStore.getState().zoomIn()}
        >
          +
        </button>
        <span className="text-zinc-600">|</span>
        <span>Grid: {showGrid ? 'On' : 'Off'}</span>
        <span>{layers.length} layer{layers.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
