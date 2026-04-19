'use client';

import { useState } from 'react';
import { useEditorStore } from '@/lib/store/editor';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AIModel, AIJob } from '@/types';

const MODELS: { value: AIModel; label: string }[] = [
  { value: 'qwen-image', label: 'Qwen Image' },
  { value: 'flux', label: 'FLUX' },
  { value: 'sdxl', label: 'SDXL' },
  { value: 'stable-diffusion', label: 'Stable Diffusion' },
];

interface AITool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  model: string;
}

const AI_TOOLS: AITool[] = [
  {
    id: 'qwen-image',
    name: 'Qwen Image',
    description: 'Generate images with Qwen VL model',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    ),
    model: 'qwen-vl',
  },
  {
    id: 'bg-remove',
    name: 'Remove BG',
    description: 'Remove background from images',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
    model: 'bria-rmbg',
  },
  {
    id: 'upscale',
    name: 'Upscale',
    description: 'Enhance image resolution 2x-4x',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
      </svg>
    ),
    model: 'real-esrgan',
  },
  {
    id: 'image-to-image',
    name: 'Image to Image',
    description: 'Transform images with prompts',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M8 12l3-3 3 3M12 9v6" />
      </svg>
    ),
    model: 'sdxl-img2img',
  },
  {
    id: 'inpaint',
    name: 'Inpaint',
    description: 'Fill masked areas with AI',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
    ),
    model: 'sd-inpainting',
  },
  {
    id: 'outpaint',
    name: 'Outpaint',
    description: 'Extend image boundaries',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <rect x="6" y="6" width="12" height="12" />
        <path d="M2 12h4M18 12h4M12 2v4M12 18v4" />
      </svg>
    ),
    model: 'sd-outpainting',
  },
  {
    id: 'face-swap',
    name: 'Face Swap',
    description: 'Swap faces in images',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <circle cx="12" cy="12" r="10" />
        <circle cx="9" cy="10" r="1.5" />
        <circle cx="15" cy="10" r="1.5" />
        <path d="M9 15c.667 1.333 1.5 2 3 2s2.333-.667 3-2" />
      </svg>
    ),
    model: 'inswapper',
  },
  {
    id: 'restore',
    name: 'Restore',
    description: 'Restore old/damaged photos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" />
        <path d="M3 3v9h9" />
      </svg>
    ),
    model: 'codeformer',
  },
];

export function PromptPanel() {
  const aiModel = useEditorStore((s) => s.aiModel);
  const setAIModel = useEditorStore((s) => s.setAIModel);
  const aiPrompt = useEditorStore((s) => s.aiPrompt);
  const setAIPrompt = useEditorStore((s) => s.setAIPrompt);
  const isGenerating = useEditorStore((s) => s.isGenerating);
  const setIsGenerating = useEditorStore((s) => s.setIsGenerating);
  const addAIJob = useEditorStore((s) => s.addAIJob);
  
  const [toolsModalOpen, setToolsModalOpen] = useState(false);

  const handleGenerate = () => {
    if (!aiPrompt.trim() || isGenerating) return;
    const job: AIJob = {
      id: `job-${Date.now()}`,
      type: 'text-to-image',
      model: aiModel,
      status: 'processing',
      prompt: aiPrompt,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    addAIJob(job);
    setIsGenerating(true);
  };

  const handleToolSelect = (tool: AITool) => {
    // Add job for selected tool
    const job: AIJob = {
      id: `job-${Date.now()}`,
      type: tool.id as any,
      model: tool.model as any,
      status: 'pending',
      prompt: `${tool.name} - ${aiPrompt || 'No prompt'}`,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    addAIJob(job);
    setToolsModalOpen(false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Prompt area */}
      <div className="flex flex-1 flex-col gap-3 p-3">
        {/* Model selector */}
        <Select value={aiModel} onValueChange={(value) => setAIModel(value as AIModel)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Prompt input */}
        <Textarea
          value={aiPrompt}
          onChange={(e) => setAIPrompt(e.target.value)}
          placeholder="Describe the image you want to generate..."
          className="min-h-[120px] resize-none flex-1"
        />

        {/* Generate button */}
        <Button onClick={handleGenerate} disabled={!aiPrompt.trim() || isGenerating} className="w-full">
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Generating...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" strokeLinejoin="round" />
              </svg>
              Generate
            </span>
          )}
        </Button>
      </div>

      <div className="h-px w-full bg-border" />

      {/* Bottom: More AI button */}
      <div className="p-3">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full text-xs h-9"
          onClick={() => setToolsModalOpen(true)}
        >
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
              <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" strokeLinejoin="round" />
              <path d="M12 2v22M2 12h20" strokeLinecap="round" />
            </svg>
            More AI
          </span>
        </Button>
      </div>

      {/* AI Tools Modal */}
      {toolsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border bg-background shadow-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-primary">
                  <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" strokeLinejoin="round" />
                  <path d="M12 2v22M2 12h20" strokeLinecap="round" />
                </svg>
                More AI
              </h2>
              <button
                onClick={() => setToolsModalOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* Tools Grid */}
            <div className="p-4 overflow-y-auto">
              <p className="text-sm text-muted-foreground mb-4">
                Select an AI tool to process your images. Configure API keys in Settings.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {AI_TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => handleToolSelect(tool)}
                    className="flex flex-col items-start gap-2 p-3 rounded-lg border hover:bg-accent hover:border-primary/50 transition-all text-left group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {tool.icon}
                      </div>
                      <span className="font-medium text-sm">{tool.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{tool.description}</p>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {tool.model}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setToolsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
