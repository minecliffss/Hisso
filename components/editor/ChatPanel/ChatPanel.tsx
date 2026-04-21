'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
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
import { generateId } from '@/lib/utils/helpers';
import { loadImageToCanvas } from '@/lib/canvas/fabric';
import type { ChatMessage, AnalysisResult, AIJob, AIModel } from '@/types';

const GENERATION_MODELS: { value: AIModel; label: string }[] = [
  { value: 'flux', label: 'FLUX.1 [dev]' },
  { value: 'sdxl', label: 'SDXL Turbo' },
  { value: 'qwen-image', label: 'Qwen Image' },
  { value: 'stable-diffusion', label: 'Stable Diffusion v2' },
];



export function ChatPanel() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [toolsModalOpen, setToolsModalOpen] = useState(false);
  const [visionModel, setVisionModel] = useState('nvidia'); // Default to NVIDIA NIM

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const addLayer = useEditorStore((s) => s.addLayer);
  const canvas = useEditorStore((s) => s.canvas);
  const aiModel = useEditorStore((s) => s.aiModel);
  const setAIModel = useEditorStore((s) => s.setAIModel);
  const addAIJob = useEditorStore((s) => s.addAIJob);
  const updateAIJob = useEditorStore((s) => s.updateAIJob);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, isProcessing, isAnalyzing, scrollToBottom]);

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

  const analyzeReferenceImage = async (image: string, userPrompt: string): Promise<AnalysisResult | null> => {
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image,
          userPrompt: userPrompt || 'Extract visual details for reproduction',
          mode: 'analyze-and-generate',
          model: 'custom', // Use custom vision AI from env
        }),
      });
      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      return data.success ? data : null;
    } catch (error) {
      console.error('Analysis error:', error);
      return null;
    }
  };

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;
    if (isProcessing) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    const currentAttachments = [...attachments];

    setInput('');
    setAttachments([]);
    setIsProcessing(true);
    scrollToBottom();

    const jobId = `job-${Date.now()}`;
    addAIJob({
      id: jobId, type: 'text-to-image', model: aiModel, status: 'processing',
      prompt: currentInput, progress: 0, createdAt: new Date(), updatedAt: new Date(),
    });

    try {
      let finalPrompt = currentInput;

      if (currentAttachments.length > 0) {
        setIsAnalyzing(true);
        const result = await analyzeReferenceImage(currentAttachments[0], currentInput);
        if (result) {
          finalPrompt = result.combinedPrompt;
        }
        setIsAnalyzing(false);
      }

      const response = await fetch('/api/generate/flux', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt, model: aiModel }),
      });

      if (!response.ok) throw new Error('Generation failed');
      const data = await response.json();

      if (data.imageUrl && canvas) {
        const layerId = generateId();
        const img = await loadImageToCanvas(canvas as any, data.imageUrl, { layerId });
        addLayer({
          id: layerId, type: 'image', src: data.imageUrl,
          name: `AI Design: ${currentInput.slice(0, 10)}...`,
          width: (img.width || 0) * (img.scaleX || 1), height: (img.height || 0) * (img.scaleY || 1),
          x: img.left || 0, y: img.top || 0,
        });
      }

      setMessages((prev) => [...prev, {
        id: generateId(), role: 'assistant',
        content: `🎨 Generated using **${aiModel.toUpperCase()}**.`,
        imageUrl: data.imageUrl, timestamp: new Date(),
      }]);

      updateAIJob(jobId, { status: 'completed', progress: 100, result: data });
    } catch (error: any) {
      setMessages((prev) => [...prev, {
        id: generateId(), role: 'assistant', content: `❌ Error: ${error.message}`,
        isError: true, timestamp: new Date(),
      }]);
      updateAIJob(jobId, { status: 'failed' });
    } finally {
      setIsProcessing(false);
      setIsAnalyzing(false);
      scrollToBottom();
    }
  };

  return (
    <div className="absolute inset-0 grid grid-rows-[auto,1fr,auto] bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-transparent z-10 gap-2 border-b border-white/5">
        <Select value={aiModel} onValueChange={(v: any) => setAIModel(v)}>
          <SelectTrigger className="h-7 w-fit gap-2 px-3 rounded-sm bg-transparent border border-white/10 text-[11px] font-bold text-muted-foreground uppercase focus:ring-0 shadow-none ring-0 transition-colors">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-sm">
            {GENERATION_MODELS.map(m => (
              <SelectItem key={m.value} value={m.value} className="text-xs uppercase font-bold py-2.5">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button 
          variant="ghost" 
          size="xs" 
          onClick={() => setToolsModalOpen(true)}
          className="h-7 gap-2 px-3 rounded-sm bg-white/5 border border-white/10 text-[10px] font-bold text-muted-foreground uppercase hover:bg-white/10 hover:text-primary transition-all"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" /></svg>
          AI Tools
        </Button>
      </div>

      {/* Messages */}
      <div className="overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-40 space-y-3">
            <div className="h-10 w-10 rounded-lg bg-transparent border flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6 text-primary/50">
                <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" />
              </svg>
            </div>
            <p className="text-xs font-bold uppercase tracking-tighter">AI Design Assistant</p>
          </div>
        )}
        
        {messages.map((m) => (
          <div key={m.id} className={cn(
            "flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300",
            m.role === 'user' ? 'items-end' : 'items-start'
          )}>
            <div className={cn("max-w-[85%] rounded-sm px-4 py-2.5 text-sm break-words", 
              m.role === 'user' ? 'bg-white/5 text-white border border-white/10' : 'bg-transparent border border-border/20')}>
              {m.content && <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>}
              {m.attachments?.map((url, i) => <img key={i} src={url} className="mt-2 rounded border max-h-32 object-cover" />)}
              {m.imageUrl && <img src={m.imageUrl} className="mt-2 rounded shadow-md w-full" />}
            </div>
          </div>
        ))}
        {(isAnalyzing || isProcessing) && (
          <div className="flex items-start">
            <div className="bg-transparent border border-border/20 rounded-lg px-3 py-2">
              <span className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                <span className="h-2 w-2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                {isAnalyzing ? 'VLM Analysis...' : 'Generating...'}
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-transparent border-t border-white/5">
        <div className="relative flex flex-col gap-2 p-0 transition-all">
          {attachments.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-1 pb-1">
              {attachments.map((url, i) => (
                <div key={i} className="relative shrink-0 group">
                  <img src={url} className="w-12 h-12 rounded object-cover border border-primary/20" />
                  <button onClick={() => removeAttachment(i)} className="absolute -top-1.5 -right-1.5 bg-black/80 backdrop-blur-md text-white rounded-full w-5 h-5 flex items-center justify-center border border-white/20 transition-all hover:scale-110 shadow-lg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" className="w-2.5 h-2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            <Button variant="ghost" size="icon-sm" onClick={() => fileInputRef.current?.click()} className="h-10 w-10 rounded-lg hover:text-primary hover:bg-primary/5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5"><path d="M12 5v14M5 12h14" /></svg>
            </Button>

            <Textarea
              value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder="Describe your design..."
              className="min-h-[40px] h-auto py-[11px] resize-none flex-1 !bg-transparent dark:!bg-transparent border-0 focus-visible:ring-0 px-0 text-sm leading-none overflow-hidden"
              disabled={isProcessing}
            />

            <Button onClick={handleSend} disabled={(!input.trim() && attachments.length === 0) || isProcessing} size="icon-sm"
              className={cn("h-10 w-10 rounded-lg shrink-0 transition-all", (input.trim() || attachments.length > 0) ? "bg-primary" : "bg-transparent border border-border/40 opacity-30")}>
              {isProcessing ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" /> :
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5 text-primary-foreground"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
