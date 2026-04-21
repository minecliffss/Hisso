'use client';

import { useState, useRef } from 'react';
import { useEditorStore } from '@/lib/store/editor';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { loadImageToCanvas } from '@/lib/canvas/fabric';
import { generateId } from '@/lib/utils/helpers';
import type { AIModel, AIJob, AnalysisResult } from '@/types';

const MODELS: { value: AIModel; label: string }[] = [
  { value: 'flux', label: 'FLUX' },
  { value: 'nvidia-kimi', label: 'NVIDIA Kimi' },
  { value: 'qwen-image', label: 'Qwen Image' },
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
  const updateAIJob = useEditorStore((s) => s.updateAIJob);
  const addLayer = useEditorStore((s) => s.addLayer);
  
  const [toolsModalOpen, setToolsModalOpen] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) setAttachments((prev) => [...prev, dataUrl]);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Analyze reference image to get a descriptive prompt
  const analyzeReferenceImage = async (image: string, userPrompt: string): Promise<AnalysisResult | null> => {
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image,
          userPrompt: userPrompt || 'Analyze this image for recreation',
          mode: 'analyze-and-generate',
          model: 'kimi', // Default to kimi for analysis as requested
        }),
      });

      if (!response.ok) throw new Error('Failed to analyze image');
      const data = await response.json();
      return data.success ? data : null;
    } catch (error) {
      console.error('Analysis error:', error);
      return null;
    }
  };

  const handleGenerate = async () => {
    if (!aiPrompt.trim() && attachments.length === 0) return;
    if (isGenerating) return;

    const jobId = `job-${Date.now()}`;
    const job: AIJob = {
      id: jobId,
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

    try {
      let finalPrompt = aiPrompt;

      // STEP 1: If reference image exists, analyze it first to ensure correspondence
      if (attachments.length > 0) {
        setIsAnalyzing(true);
        const analysisData = await analyzeReferenceImage(attachments[0], aiPrompt);
        if (analysisData) {
          finalPrompt = analysisData.combinedPrompt;
          console.log('Using analyzed prompt for correspondence:', finalPrompt);
        }
        setIsAnalyzing(false);
      }

      // STEP 2: Generate the image
      const response = await fetch('/api/generate/flux', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: finalPrompt,
          model: aiModel,
          // Forward attachment for image-to-image if supported by backend
          images: attachments.length > 0 ? attachments : undefined 
        }),
      });

      if (!response.ok) {
        let errText = 'Failed to generate image';
        try {
          const errJson = await response.json();
          errText += ': ' + (errJson.details || errJson.error || JSON.stringify(errJson));
        } catch(e) {
          errText += ' (status: ' + response.status + ')';
        }
        throw new Error(errText);
      }

      const data = await response.json();
      if (data.imageUrl) {
        const canvas = useEditorStore.getState().canvas;
        if (canvas) {
          const layerId = generateId();
          const img = await loadImageToCanvas(canvas as any, data.imageUrl, { layerId });

          addLayer({
            id: layerId,
            type: 'image',
            src: data.imageUrl,
            name: `Generated: ${aiPrompt.slice(0, 15) || 'Reference-based'}...`,
            width: (img.width || 0) * (img.scaleX || 1),
            height: (img.height || 0) * (img.scaleY || 1),
            x: img.left || 0,
            y: img.top || 0,
          });
        }
        updateAIJob(jobId, { status: 'completed', progress: 100, result: data });
        setAttachments([]);
      } else {
        throw new Error(data.error || 'No image URL returned');
      }
    } catch (error) {
      console.error(error);
      updateAIJob(jobId, { status: 'failed' });
    } finally {
      setIsGenerating(false);
      setIsAnalyzing(false);
    }
  };

  const handleToolSelect = (tool: AITool) => {
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
    <div className="flex h-full flex-col bg-background">
      {/* Prompt area */}
      <div className="flex-1 flex flex-col gap-4 p-4">
        {/* Model Selector Dropdown - Decreased Radius */}
        <div className="flex items-center justify-between shrink-0">
          <Select value={aiModel} onValueChange={(value) => setAIModel(value as AIModel)}>
            <SelectTrigger className="w-fit h-8 gap-2 px-3 rounded-lg bg-primary/10 border-primary/20 hover:bg-primary/20 transition-colors text-primary border-0 focus:ring-0 shadow-none ring-0">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
              <div className="text-[11px] font-bold uppercase tracking-wider">
                <SelectValue placeholder="Select Model" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              {MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs font-medium">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-tighter">AI Generation</span>
        </div>

        {/* Prompt input - Expanded with Integrated Attachment UI - Decreased Radius */}
        <div className="relative flex-1 group min-h-[260px] flex flex-col bg-muted/10 border border-border/40 rounded-xl overflow-hidden focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/5 transition-all">
          
          {/* Attachment Chips Area - Decreased Radius */}
          {attachments.length > 0 && (
            <div className="flex gap-3 overflow-x-auto p-3 pb-1">
              {attachments.map((url, idx) => (
                <div key={idx} className="relative shrink-0 group/chip">
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-background shadow-md group-hover/chip:border-primary/40 transition-all">
                    <img src={url} alt="Ref" className="w-full h-full object-cover" />
                  </div>
                  <button
                    onClick={() => removeAttachment(idx)}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-lg border border-background scale-0 group-hover/chip:scale-100 transition-transform"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Text Area */}
          <Textarea
            value={aiPrompt}
            onChange={(e) => setAIPrompt(e.target.value)}
            placeholder={attachments.length > 0 ? "Describe changes to the reference image..." : "What would you like to create?..."}
            className="flex-1 w-full resize-none bg-transparent border-0 focus-visible:ring-0 p-4 text-sm leading-relaxed placeholder:text-muted-foreground/50"
          />

          {/* Action Bar inside Prompt Box - Decreased Radius */}
          <div className="flex items-center justify-between p-2 bg-muted/5 border-t border-border/10">
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 w-8 rounded-lg bg-background border shadow-sm hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all"
                title="Attach Reference Image"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
              <span className="text-[10px] font-medium text-muted-foreground/60">
                {attachments.length > 0 ? `${attachments.length} attached` : 'Add reference'}
              </span>
            </div>
            
            <div className="flex items-center gap-1 opacity-20 group-focus-within:opacity-100 transition-opacity">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-primary">
                <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Generate button with Animation - Decreased Radius */}
        <Button 
          onClick={handleGenerate} 
          disabled={(!aiPrompt.trim() && attachments.length === 0) || isGenerating} 
          className={cn(
            "w-full h-12 relative overflow-hidden transition-all duration-300 rounded-lg shadow-sm",
            isGenerating ? "bg-primary/90" : "bg-primary hover:shadow-md active:translate-y-px"
          )}
        >
          {isGenerating ? (
            <div className="flex items-center justify-center gap-3">
              <div className="relative flex items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              </div>
              <span className="text-sm font-bold tracking-wide">
                {isAnalyzing ? 'Analyzing Reference...' : 'Creating Magic...'}
              </span>
              <div className="absolute bottom-0 left-0 h-1 bg-white/30 animate-[shimmer_2s_infinite]" style={{ width: '100%' }} />
            </div>
          ) : (
            <span className="flex items-center gap-2 text-sm font-bold">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" strokeLinejoin="round" />
              </svg>
              {attachments.length > 0 ? 'Correspond & Generate' : 'Generate Image'}
            </span>
          )}
        </Button>
      </div>

      {/* More AI Tools Section - Decreased Radius */}
      <div className="px-4 pb-4 mt-auto">
        <div 
          onClick={() => setToolsModalOpen(true)}
          className="group relative flex items-center justify-between p-3 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all overflow-hidden"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" strokeLinejoin="round" />
                <path d="M12 2v22M2 12h20" strokeLinecap="round" opacity="0.3" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold">Advanced Tools</p>
              <p className="text-[10px] text-muted-foreground">Upscale, Restore & more</p>
            </div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* AI Tools Modal - Decreased Radius */}
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
