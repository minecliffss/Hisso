'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { useEditorStore } from '@/lib/store/editor';
import type { AIJob, AIJobStatus, AIJobType, AIModel } from '@/types';

const MODEL_OPTIONS: { id: AIModel; label: string }[] = [
  { id: 'qwen-image', label: 'Qwen Image' },
  { id: 'flux', label: 'FLUX' },
  { id: 'sdxl', label: 'SDXL' },
  { id: 'stable-diffusion', label: 'Stable Diffusion' },
];

const SIZE_PRESETS = ['1024x1024', '1024x1792', '1792x1024', 'Custom'] as const;

const EDIT_TOOLS: {
  type: AIJobType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    type: 'remove-background',
    label: 'Remove Background',
    description: 'Cut out the subject cleanly.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <path d="M7 7l10 10M7 17L17 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: 'upscale',
    label: 'Upscale 2x/4x',
    description: 'Enhance resolution and detail.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <path d="M8 8h8v8M8 16l8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    type: 'inpaint',
    label: 'Inpaint',
    description: 'Replace selected areas naturally.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <path d="M7 15c2-5 8-5 10 0M8.5 9.5l2 2m3-2l-2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: 'style-transfer',
    label: 'Style Transfer',
    description: 'Apply a visual style reference.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <path d="M7 16c2-6 9-9 10-2 1 5-5 7-8 4-2-2-2-5-1-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: 'face-enhance',
    label: 'Face Enhance',
    description: 'Sharpen facial detail and clarity.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="9.5" cy="11" r="0.8" fill="currentColor" />
        <circle cx="14.5" cy="11" r="0.8" fill="currentColor" />
        <path d="M10 14.5c1 1 3 1 4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
];

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M19 14l.9 2.6L22.5 17l-2.6.9L19 20.5l-.9-2.6-2.6-.9 2.6-.9L19 14Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function getStatusStyles(status: AIJobStatus) {
  switch (status) {
    case 'completed': return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
    case 'processing': return 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300';
    case 'failed': return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
    default: return 'border-zinc-700 bg-zinc-800 text-zinc-300';
  }
}

function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function truncate(text: string, limit = 60) {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

type AITab = 'generate' | 'edit' | 'history';

export function AIPanel() {
  const [innerTab, setInnerTab] = useState<AITab>('generate');
  const [negativeOpen, setNegativeOpen] = useState(false);

  const {
    aiModel,
    setAIModel,
    aiPrompt,
    setAIPrompt,
    aiNegativePrompt,
    setAINegativePrompt,
    isGenerating,
    setIsGenerating,
    aiJobs,
    selectedLayerId,
    addAIJob,
  } = useEditorStore();

  const startGeneration = () => {
    const job: AIJob = {
      id: `job-${Date.now()}`,
      type: 'text-to-image',
      model: aiModel,
      status: 'processing',
      prompt: aiPrompt,
      negativePrompt: aiNegativePrompt || undefined,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    addAIJob(job);
    setIsGenerating(true);
  };

  return (
    <div className="flex h-full w-72 flex-col bg-zinc-900 text-zinc-100">
      {/* Inner tab switcher */}
      <div className="border-b border-zinc-800 p-2">
        <div className="flex rounded-lg bg-zinc-950/60 p-1">
          {(['generate', 'edit', 'history'] as AITab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setInnerTab(tab)}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                innerTab === tab ? 'bg-zinc-800 text-indigo-300' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {innerTab === 'generate' && (
          <div className="space-y-4">
            {/* Model selector */}
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Model</div>
              <div className="grid grid-cols-2 gap-1.5">
                {MODEL_OPTIONS.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setAIModel(model.id)}
                    className={cn(
                      'rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                      aiModel === model.id
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600'
                    )}
                  >
                    {model.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Prompt</div>
              <textarea
                value={aiPrompt}
                onChange={(e) => {
                  e.currentTarget.style.height = 'auto';
                  e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                  setAIPrompt(e.target.value);
                }}
                rows={4}
                placeholder="Describe the image you want to generate..."
                className="min-h-24 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-indigo-500"
              />
            </div>

            {/* Negative prompt */}
            <div>
              <button
                type="button"
                onClick={() => setNegativeOpen((open) => !open)}
                className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
              >
                Negative prompt {negativeOpen ? '−' : '+'}
              </button>
              {negativeOpen && (
                <textarea
                  value={aiNegativePrompt}
                  onChange={(e) => setAINegativePrompt(e.target.value)}
                  rows={3}
                  placeholder="What to avoid..."
                  className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-indigo-500"
                />
              )}
            </div>

            {/* Size presets */}
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Size</div>
              <div className="grid grid-cols-2 gap-1.5">
                {SIZE_PRESETS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-600"
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <Button
              type="button"
              onClick={startGeneration}
              disabled={!aiPrompt.trim() || isGenerating}
              className="w-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <SparkleIcon />
              <span className="ml-2">Generate</span>
            </Button>

            {/* Progress */}
            {isGenerating && (
              <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Generating...</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-indigo-500 transition-all animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            )}
          </div>
        )}

        {innerTab === 'edit' && (
          <div className="space-y-3">
            {!selectedLayerId ? (
              <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-950/50 p-4 text-sm text-zinc-400">
                Select a layer first
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {EDIT_TOOLS.map((tool) => (
                  <button
                    key={tool.type}
                    type="button"
                    className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-800/80 p-3 text-left transition-colors hover:border-indigo-500/40 hover:bg-zinc-800"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-zinc-200">
                      {tool.icon}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-100">{tool.label}</div>
                      <div className="text-xs text-zinc-400">{tool.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {innerTab === 'history' && (
          <div className="space-y-2">
            {aiJobs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-950/50 p-4 text-sm text-zinc-400">
                No AI jobs yet.
              </div>
            ) : (
              aiJobs.map((job) => (
                <div
                  key={job.id}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-800/70 p-3 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-zinc-100">{truncate(job.prompt ?? job.type.replace(/-/g, ' '), 34)}</p>
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide', getStatusStyles(job.status))}>
                      {job.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                    <span>{job.model}</span>
                    <span>{formatTimestamp(job.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
