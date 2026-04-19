'use client';

import { useRef } from 'react';
import { CanvasComponent } from '@/components/editor/Canvas/Canvas';
import { AIPanel } from '@/components/editor/AIPanel/AIPanel';
import { TextPanel } from '@/components/editor/TextPanel/TextPanel';
import { Layers } from '@/components/editor/Layers/Layers';
import { ExportPanel } from '@/components/editor/ExportPanel/ExportPanel';
import { StatusBar } from '@/components/editor/StatusBar/StatusBar';
import { useEditorStore } from '@/lib/store/editor';
import { loadImageToCanvas } from '@/lib/canvas/fabric';
import { readFileAsDataURL } from '@/lib/utils/helpers';
import { cn } from '@/lib/utils/cn';
import type { RightPanelTab } from '@/types';

const TABS: { id: RightPanelTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'ai',
    label: 'AI',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'text',
    label: 'Text',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M5 7V5h14v2" strokeLinecap="round" />
        <path d="M12 5v14" strokeLinecap="round" />
        <path d="M9 19h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'layers',
    label: 'Layers',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M12 2L2 7l10 5 10-5-10-5Z" strokeLinejoin="round" />
        <path d="M2 17l10 5 10-5" strokeLinejoin="round" />
        <path d="M2 12l10 5 10-5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'export',
    label: 'Export',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M12 3v10" strokeLinecap="round" />
        <path d="M8 10l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 17h14" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function Editor() {
  const activeRightTab = useEditorStore((state) => state.activeRightTab);
  const setActiveRightTab = useEditorStore((state) => state.setActiveRightTab);
  const canvas = useEditorStore((state) => state.canvas);
  const addLayer = useEditorStore((state) => state.addLayer);
  const saveHistory = useEditorStore((state) => state.saveHistory);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvas) return;

    try {
      const dataUrl = await readFileAsDataURL(file);
      const img = await loadImageToCanvas(canvas as any, dataUrl);
      addLayer({
        type: 'image',
        name: file.name.replace(/\.[^/.]+$/, ''),
        src: dataUrl,
        width: (img.width || 0) * (img.scaleX || 1),
        height: (img.height || 0) * (img.scaleY || 1),
        x: img.left || 0,
        y: img.top || 0,
      });
      saveHistory('import_image');
    } catch (err) {
      console.error('Failed to import image:', err);
    }

    // Reset input so same file can be re-imported
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950">
      {/* Top bar */}
      <header className="flex h-10 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-wide text-indigo-400">Hisso</span>
          <span className="text-xs text-zinc-500">AI</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImportImage}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Import Image
          </button>
          <button
            type="button"
            className="rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            New Project
          </button>
          <button
            type="button"
            onClick={() => setActiveRightTab('export')}
            className="rounded-md bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700 transition-colors"
          >
            Export
          </button>
        </div>
      </header>

      {/* Main area: Canvas | Right sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <CanvasComponent />
          <StatusBar />
        </div>

        {/* Right sidebar with tabs */}
        <div className="flex flex-col border-l border-zinc-800 bg-zinc-900 shrink-0">
          {/* Tab bar */}
          <div className="flex border-b border-zinc-800 shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveRightTab(tab.id)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-medium transition-colors',
                  activeRightTab === tab.id
                    ? 'text-indigo-400 border-b-2 border-indigo-400'
                    : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {activeRightTab === 'ai' && <AIPanel />}
            {activeRightTab === 'text' && <TextPanel />}
            {activeRightTab === 'layers' && <Layers />}
            {activeRightTab === 'export' && <ExportPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}
