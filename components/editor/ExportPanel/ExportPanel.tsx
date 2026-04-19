'use client';

import { useState } from 'react';
import { useEditorStore } from '@/lib/store/editor';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils/cn';
import { exportCanvas } from '@/lib/canvas/fabric';
import { downloadFile } from '@/lib/utils/helpers';

const formats = ['png', 'jpg', 'webp'] as const;
const scales = [1, 2, 4];

export function ExportPanel() {
  const canvas = useEditorStore((state) => state.canvas);
  const canvasWidth = useEditorStore((state) => state.canvasWidth);
  const canvasHeight = useEditorStore((state) => state.canvasHeight);
  const exportFormat = useEditorStore((state) => state.exportFormat);
  const exportQuality = useEditorStore((state) => state.exportQuality);
  const setExportFormat = useEditorStore((state) => state.setExportFormat);
  const setExportQuality = useEditorStore((state) => state.setExportQuality);
  const [scale, setScale] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const showQuality = exportFormat !== 'png';

  const handleExport = () => {
    if (!canvas || isExporting) return;

    setIsExporting(true);
    try {
      const url = exportCanvas(canvas as any, {
        format: exportFormat === 'jpg' ? 'jpeg' : exportFormat,
        quality: exportQuality,
        multiplier: scale,
      });
      downloadFile(url, `hisso-export.${exportFormat}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <aside className="w-72 border-l border-zinc-800 bg-zinc-900 text-zinc-100">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold">Export</h2>
        <p className="text-xs text-zinc-500">Render and download the current canvas.</p>
      </div>

      <div className="space-y-4 px-4 py-4">
        <section className="space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Export Format
          </div>

          <div className="grid grid-cols-3 gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
            {formats.map((format) => (
              <Button
                key={format}
                type="button"
                variant="ghost"
                size="sm"
                isActive={exportFormat === format}
                onClick={() => setExportFormat(format)}
                className={cn(
                  'h-8 rounded-md text-xs capitalize text-zinc-300 hover:bg-zinc-800 hover:text-white',
                  exportFormat === format && 'bg-indigo-600 text-white hover:bg-indigo-600'
                )}
              >
                {format}
              </Button>
            ))}
          </div>

          {showQuality ? (
            <Slider
              label="Quality"
              value={exportQuality}
              min={0.1}
              max={1}
              step={0.05}
              onChange={setExportQuality}
              className="pt-1"
            />
          ) : null}

          <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
            <span>Canvas Size</span>
            <span className="font-medium text-zinc-200">
              {canvasWidth} × {canvasHeight}
            </span>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-400">Scale</div>
            <div className="grid grid-cols-3 gap-1">
              {scales.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant="ghost"
                  size="sm"
                  isActive={scale === value}
                  onClick={() => setScale(value)}
                  className={cn(
                    'h-8 rounded-md text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white',
                    scale === value && 'bg-indigo-600 text-white hover:bg-indigo-600'
                  )}
                >
                  {value}x
                </Button>
              ))}
            </div>
          </div>
        </section>

        <Button
          type="button"
          onClick={handleExport}
          disabled={!canvas || isExporting}
          className="flex h-10 w-full items-center justify-center gap-2 bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M12 3v10" />
            <path d="M8 10l4 4 4-4" />
            <path d="M5 17h14" />
          </svg>
          Export Image
        </Button>
      </div>
    </aside>
  );
}
