'use client';

import { useRef, useEffect, useState } from 'react';
import { CanvasComponent } from '@/components/editor/Canvas/Canvas';
import { PromptPanel } from '@/components/editor/PromptPanel/PromptPanel';
import { SettingsDialog } from '@/components/editor/SettingsDialog/SettingsDialog';
import { useEditorStore } from '@/lib/store/editor';
import { loadImageToCanvas } from '@/lib/canvas/fabric';
import { readFileAsDataURL } from '@/lib/utils/helpers';
import { Button } from '@/components/ui/button';

export function Editor() {
  const canvas = useEditorStore((state) => state.canvas);
  const addLayer = useEditorStore((state) => state.addLayer);
  const saveHistory = useEditorStore((state) => state.saveHistory);
  const isDark = useEditorStore((state) => state.isDark);
  const toggleTheme = useEditorStore((state) => state.toggleTheme);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Sync dark class to <html> so shadcn CSS variables work
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top bar */}
      <header className="flex h-10 items-center justify-between border-b bg-background px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-xs" onClick={() => setSettingsOpen(true)} title="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Button>
          <span className="text-sm font-bold tracking-tight">Hisso</span>
          <span className="text-[10px] font-medium text-muted-foreground">AI</span>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImportImage}
            className="hidden"
          />
          <Button variant="ghost" size="xs" onClick={() => fileInputRef.current?.click()}>
            Import
          </Button>
          <div className="h-4 w-px bg-border" />
          <Button variant="ghost" size="xs" onClick={toggleTheme}>
            {isDark ? '☀' : '☾'}
          </Button>
        </div>
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <CanvasComponent />
        </div>

        {/* Right: Prompt panel only */}
        <aside className="w-72 border-l bg-background shrink-0">
          <PromptPanel />
        </aside>
      </div>

      {/* Settings dialog */}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
