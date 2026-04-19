'use client';

import * as React from 'react';
import { useEditorStore } from '@/lib/store/editor';
import type { Layer, ToolType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils/cn';

const presetStyles = [
  { label: 'Heading', fontSize: 48, fontWeight: 700, fill: '#ffffff', preview: 'Heading' },
  { label: 'Subtitle', fontSize: 32, fontWeight: 600, fill: '#a1a1aa', preview: 'Subtitle' },
  { label: 'Body', fontSize: 18, fontWeight: 400, fill: '#ffffff', preview: 'Body text' },
  { label: 'Caption', fontSize: 14, fontWeight: 300, fill: '#a1a1aa', preview: 'Caption' },
] as const;

const weightOptions = [
  { label: 'Light', value: 300 },
  { label: 'Regular', value: 400 },
  { label: 'Medium', value: 500 },
  { label: 'Bold', value: 700 },
] as const;

const alignmentOptions = [
  {
    label: 'Left',
    value: 'left' as const,
    icon: (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M3 4h14" />
        <path d="M3 9h9" />
        <path d="M3 14h12" />
      </svg>
    ),
  },
  {
    label: 'Center',
    value: 'center' as const,
    icon: (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M3 4h14" />
        <path d="M5 9h10" />
        <path d="M4 14h12" />
      </svg>
    ),
  },
  {
    label: 'Right',
    value: 'right' as const,
    icon: (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M3 4h14" />
        <path d="M8 9h9" />
        <path d="M5 14h12" />
      </svg>
    ),
  },
];

function updateTextLayer(id: string, updates: Partial<Layer>) {
  useEditorStore.getState().updateLayer(id, updates);
}

export function TextPanel() {
  const selectedLayer = useEditorStore((state) => state.layers.find((l) => l.id === state.selectedLayerId));
  const activeTool = useEditorStore((state) => state.activeTool);
  const addLayer = useEditorStore((state) => state.addLayer);
  const updateLayer = useEditorStore((state) => state.updateLayer);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);

  const isTextLayer = selectedLayer?.type === 'text';
  const textLayer = isTextLayer ? selectedLayer : null;

  const currentText = textLayer?.text ?? '';
  const currentFontFamily = textLayer?.fontFamily ?? 'Inter';
  const currentFontSize = textLayer?.fontSize ?? 18;
  const currentFill = textLayer?.fill ?? '#ffffff';
  const currentStroke = textLayer?.stroke ?? '#000000';
  const currentStrokeWidth = textLayer?.strokeWidth ?? 0;

  const handleAddText = () => {
    addLayer({
      type: 'text',
      name: 'Text',
      text: 'Double click to edit',
      fontFamily: 'Inter',
      fontSize: 18,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 0,
    });
    setActiveTool('text' as ToolType);
  };

  const handlePreset = (preset: (typeof presetStyles)[number]) => {
    addLayer({
      type: 'text',
      name: preset.label,
      text: preset.label,
      fontFamily: 'Inter',
      fontSize: preset.fontSize,
      fill: preset.fill,
      stroke: '#000000',
      strokeWidth: 0,
    });
    setActiveTool('text' as ToolType);
  };

  return (
    <div className="w-72 border-l border-zinc-800 bg-zinc-900 text-zinc-100 h-full overflow-y-auto">
      <div className="p-3 space-y-4">
        <section className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Add Text</div>
          <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={handleAddText}>
            Add Text
          </Button>
          <div className="grid grid-cols-2 gap-2">
            {presetStyles.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePreset(preset)}
                className={cn(
                  'rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800/70'
                )}
              >
                <div className="text-[11px] text-zinc-500 mb-1">{preset.label}</div>
                <div
                  className="truncate"
                  style={{ fontSize: preset.fontSize, fontWeight: preset.fontWeight, color: preset.fill }}
                >
                  {preset.preview}
                </div>
              </button>
            ))}
          </div>
        </section>

        {isTextLayer && textLayer && (
          <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Edit Text</div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Content</label>
              <textarea
                value={currentText}
                onChange={(e) => updateLayer(textLayer.id, { text: e.target.value })}
                rows={3}
                className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter text"
              />
            </div>

            <Input
              label="Font family"
              value={currentFontFamily}
              onChange={(value) => updateTextLayer(textLayer.id, { fontFamily: value })}
              placeholder="Inter"
            />

            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <Input
                  label="Font size"
                  type="number"
                  value={String(currentFontSize)}
                  onChange={(value) => updateTextLayer(textLayer.id, { fontSize: Number(value) || 0 })}
                  className="w-24"
                />
                <div className="flex-1 pb-1">
                  <Slider
                    value={currentFontSize}
                    min={8}
                    max={200}
                    step={1}
                    onChange={(value) => updateTextLayer(textLayer.id, { fontSize: value })}
                    showValue={false}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Font weight</label>
              <div className="grid grid-cols-4 gap-1.5">
                {weightOptions.map((option) => (
                  <Button
                    key={option.label}
                    type="button"
                    size="sm"
                    variant="secondary"
                    isActive={(textLayer.fontWeight ?? 400) === option.value}
                    className="px-2"
                    onClick={() => updateTextLayer(textLayer.id, { fontWeight: option.value })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Alignment</label>
              <div className="grid grid-cols-3 gap-1.5">
                {alignmentOptions.map((option) => (
                  <Button
                    key={option.label}
                    type="button"
                    size="sm"
                    variant="secondary"
                    isActive={(textLayer.textAlign ?? 'left') === option.value}
                    onClick={() => updateTextLayer(textLayer.id, { textAlign: option.value })}
                  >
                    <span className="mr-1.5">{option.icon}</span>
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Fill</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={currentFill}
                    onChange={(e) => updateTextLayer(textLayer.id, { fill: e.target.value })}
                    className="h-9 w-10 rounded-md border border-zinc-700 bg-zinc-800 p-1"
                  />
                  <Input value={currentFill} onChange={(value) => updateTextLayer(textLayer.id, { fill: value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Stroke</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={currentStroke}
                    onChange={(e) => updateTextLayer(textLayer.id, { stroke: e.target.value })}
                    className="h-9 w-10 rounded-md border border-zinc-700 bg-zinc-800 p-1"
                  />
                  <Input value={currentStroke} onChange={(value) => updateTextLayer(textLayer.id, { stroke: value })} />
                </div>
              </div>
            </div>

            <Slider
              label="Stroke width"
              value={currentStrokeWidth}
              min={0}
              max={10}
              step={1}
              onChange={(value) => updateTextLayer(textLayer.id, { strokeWidth: value })}
            />

            <Slider
              label="Letter spacing"
              value={textLayer.letterSpacing ?? 0}
              min={-5}
              max={20}
              step={1}
              onChange={(value) => updateTextLayer(textLayer.id, { letterSpacing: value })}
            />

            <Slider
              label="Line height"
              value={textLayer.lineHeight ?? 1.2}
              min={0.8}
              max={3}
              step={0.1}
              onChange={(value) => updateTextLayer(textLayer.id, { lineHeight: value })}
            />
          </section>
        )}

        {!isTextLayer && (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-500">
            Select a text layer to edit its properties.
          </div>
        )}
      </div>
    </div>
  );
}
