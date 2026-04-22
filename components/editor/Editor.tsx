'use client';

import { useRef, useEffect, useState } from 'react';
import { CanvasComponent } from '@/components/editor/Canvas/Canvas';
import { ChatPanel } from '@/components/editor/ChatPanel/ChatPanel';
import { SettingsDialog } from '@/components/editor/SettingsDialog/SettingsDialog';
import { useEditorStore } from '@/lib/store/editor';
import { loadImageToCanvas } from '@/lib/canvas/fabric';
import { readFileAsDataURL } from '@/lib/utils/helpers';
import { Button } from '@/components/ui/button';
import { LayersSection } from './LayersSection';
import { PromptPanel } from './PromptPanel/PromptPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { storageService, projectService } from '@/lib/services/supabase-service';
import { Save, Upload, Moon, Sun, Settings, FilePlus, Sparkles, Layers } from 'lucide-react';
import { uploadImageAction } from '@/lib/actions/upload';

export function Editor() {
  const canvas = useEditorStore((state) => state.canvas);
  const addLayer = useEditorStore((state) => state.addLayer);
  const saveHistory = useEditorStore((state) => state.saveHistory);
  const isDark = useEditorStore((state) => state.isDark);
  const toggleTheme = useEditorStore((state) => state.toggleTheme);
  const layers = useEditorStore((state) => state.layers);
  const canvasWidth = useEditorStore((state) => state.canvasWidth);
  const canvasHeight = useEditorStore((state) => state.canvasHeight);
  const backgroundColor = useEditorStore((state) => state.backgroundColor);
  const resetEditor = useEditorStore((state) => state.resetEditor);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync dark class to <html> so shadcn CSS variables work
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const handleImportImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvas) return;
    try {
      // 1. Upload via Server Action
      console.log('Attemping upload via Server Action...', file.name);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const result = await uploadImageAction(formData);

      if (!result.success) {
        throw new Error(result.error || 'Server upload failed');
      }

      const publicUrl = result.url!;
      
      // 2. Generate a shared ID for fabric object + layer store
      const { generateId } = await import('@/lib/utils/helpers');
      const layerId = generateId();
      
      // 3. Load into Fabric Canvas with the shared ID
      console.log('Upload successful, loading to canvas:', publicUrl);
      const img = await loadImageToCanvas(canvas as any, publicUrl, { layerId }).catch(err => {
        throw new Error(`Fabric.js error: ${err.message || 'Failed to load image from URL'}`);
      });
      
      // 4. Add to Layer Store with the SAME ID
      addLayer({
        id: layerId,
        type: 'image',
        name: file.name.replace(/\.[^/.]+$/, ''),
        src: publicUrl,
        width: (img.width || 0) * (img.scaleX || 1),
        height: (img.height || 0) * (img.scaleY || 1),
        x: img.left || 0,
        y: img.top || 0,
      });
      saveHistory('import_image');
      console.log('Import successful');
    } catch (err: any) {
      console.error('Failed to import image:', err);
      alert(err.message || 'Failed to import image. Check console.');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveProject = async () => {
    if (!layers.length) return alert('Cannot save an empty project.');
    setIsSaving(true);
    try {
      await projectService.saveProject({
        name: 'Untitled Project',
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: backgroundColor,
        layers: layers,
      });
      alert('Project saved successfully!');
    } catch (err: any) {
      console.error('Failed to save project:', err);
      alert(`Failed to save project: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewProject = () => {
    if (confirm('Are you sure you want to start a new project? All unsaved changes will be lost.')) {
      resetEditor();
      if (canvas) {
        canvas.clear();
        canvas.backgroundColor = backgroundColor;
        canvas.renderAll();
      }
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top bar */}
      <header className="flex h-10 items-center justify-between border-b bg-background px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-xs" onClick={() => setSettingsOpen(true)} title="Settings">
            <Settings className="h-4 w-4" />
          </Button>
          <span className="text-sm font-bold tracking-tight">Hisso</span>
          <span className="text-[10px] font-medium text-muted-foreground">AI</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-hidden">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImportImage}
            className="hidden"
          />
          <Button variant="ghost" size="xs" onClick={handleNewProject} className="gap-1.5 shrink-0">
            <FilePlus className="h-3.5 w-3.5" />
            New
          </Button>
          <div className="h-4 w-px bg-border shrink-0" />
          <Button variant="ghost" size="xs" onClick={() => fileInputRef.current?.click()} className="gap-1.5 shrink-0">
            <Upload className="h-3.5 w-3.5" />
            Import
          </Button>
          <Button variant="default" size="xs" onClick={handleSaveProject} disabled={isSaving} className="gap-1.5 px-3 shrink-0">
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <div className="h-4 w-px bg-border mx-1 shrink-0" />
          <Button variant="ghost" size="icon-xs" onClick={toggleTheme} className="shrink-0">
            {!isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas - Main Area */}
        <div className="flex flex-1 flex-col overflow-hidden bg-black/50">
          <CanvasComponent />
        </div>

        {/* Right Sidebar: Redesigned */}
        <aside className="w-84 shrink-0 flex flex-col h-full min-h-0 overflow-hidden relative bg-background border-l border-black/5 dark:border-white/5">
          {/* Subtle gradient accent at top */}
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.2), transparent)' }} />

          <Tabs defaultValue="ai" className="flex-1 flex flex-col min-h-0">
            <div className="px-3 pt-2 pb-0">
              <TabsList className="w-full grid grid-cols-2 h-10 p-1 rounded-[10px] bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.04]">
                <TabsTrigger value="ai" className="gap-2 text-xs font-semibold" style={{ borderRadius: '8px' }}>
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Design
                </TabsTrigger>
                <TabsTrigger value="layers" className="gap-2 text-xs font-semibold" style={{ borderRadius: '8px' }}>
                  <Layers className="h-3.5 w-3.5" />
                  Layers
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab 1: AI Design - Chat Bot Style (Full Height) */}
            <TabsContent value="ai" className="flex-1 relative min-h-0 m-0 p-0 border-0 focus-visible:ring-0 overflow-hidden">
              <ChatPanel />
            </TabsContent>

            {/* Tab 2: Layers Section - Full Height */}
            <TabsContent value="layers" className="flex-1 flex flex-col overflow-hidden m-0 p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.04] dark:border-white/[0.04]">
                <span className="text-xs font-bold tracking-tight text-foreground/50">Project Layers</span>
                <Button variant="ghost" size="icon-xs" className="h-6 w-6 opacity-40 hover:opacity-100 transition-opacity">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                    <path d="M7 13l5 5 5-5M7 6l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <LayersSection />
              </div>
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      {/* Settings dialog */}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
