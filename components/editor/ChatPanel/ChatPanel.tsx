'use client';

import './ChatPanel.css';

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

// ═══════════════════════════════════════════════════════════════
// Generation models the user can choose from
// Currently FLUX is available; more can be added here
// ═══════════════════════════════════════════════════════════════
const GENERATION_MODELS: { value: AIModel; label: string; shortLabel: string }[] = [
  { value: 'flux', label: 'FLUX.1 [schnell]', shortLabel: 'FLUX' },
  { value: 'sdxl', label: 'SDXL Turbo', shortLabel: 'SDXL' },
  { value: 'stable-diffusion', label: 'Stable Diffusion v2', shortLabel: 'SD v2' },
];

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [toolsModalOpen, setToolsModalOpen] = useState(false);

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

  // ── File handling ──
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

  // ═══════════════════════════════════════════════════════════════
  // PIPELINE STEP 1: Resize image (client-side, reduces payload)
  // ═══════════════════════════════════════════════════════════════
  const resizeImageForVLM = useCallback(async (dataUrl: string, maxSize = 768): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        if (width <= maxSize && height <= maxSize) {
          resolve(dataUrl);
          return;
        }
        const scale = maxSize / Math.max(width, height);
        const cvs = document.createElement('canvas');
        cvs.width = Math.round(width * scale);
        cvs.height = Math.round(height * scale);
        const ctx = cvs.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
        resolve(cvs.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // PIPELINE STEP 2: Send image + user prompt → VLM → enhanced prompt
  // ═══════════════════════════════════════════════════════════════
  const callVLM = async (image: string, userPrompt: string): Promise<string | null> => {
    const VLM_TIMEOUT = 30_000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VLM_TIMEOUT);

    try {
      // Resize image to reduce payload before sending to VLM
      const resizedImage = await resizeImageForVLM(image);
      console.log(`[Pipeline] Step 2: VLM — image ${Math.round(image.length / 1024)}KB → ${Math.round(resizedImage.length / 1024)}KB`);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          image: resizedImage,
          userPrompt,
          model: 'custom', // Uses Kimi K2.5 via NVIDIA NIM
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[Pipeline] VLM returned ${response.status}, skipping`);
        return null;
      }

      const data = await response.json();
      if (data.success && data.prompt) {
        console.log(`[Pipeline] VLM returned enhanced prompt (${data.prompt.length} chars)`);
        return data.prompt;
      }

      return null;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.warn('[Pipeline] VLM timed out after 30s');
      } else {
        console.error('[Pipeline] VLM error:', error);
      }
      return null;
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // PIPELINE STEP 3: Send enhanced prompt → generation model → image
  // ═══════════════════════════════════════════════════════════════
  const callGenerate = async (prompt: string, model: AIModel): Promise<{ imageUrl: string } | null> => {
    console.log(`[Pipeline] Step 3: Generate — model=${model}, prompt=${prompt.slice(0, 80)}...`);

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Generation failed (${response.status})`);
    }

    const data = await response.json();
    if (data.success && data.imageUrl) {
      return { imageUrl: data.imageUrl };
    }
    throw new Error('No image returned from generation');
  };

  // ═══════════════════════════════════════════════════════════════
  // FULL PIPELINE: handleSend orchestrates everything
  //
  //   If image attached:
  //     Image + System Prompt + User Prompt → VLM → Enhanced Prompt → Generate
  //   If text only:
  //     User Prompt → Generate (directly)
  //
  //   User picks which generation model (FLUX, SDXL, etc.)
  // ═══════════════════════════════════════════════════════════════
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
    const selectedModel = aiModel; // User's chosen generation model

    setInput('');
    setAttachments([]);
    setIsProcessing(true);
    scrollToBottom();

    const jobId = `job-${Date.now()}`;
    addAIJob({
      id: jobId, type: 'text-to-image', model: selectedModel, status: 'processing',
      prompt: currentInput, progress: 0, createdAt: new Date(), updatedAt: new Date(),
    });

    try {
      let finalPrompt = currentInput;

      // ── STEP 2: VLM Analysis (only if image attached) ──
      if (currentAttachments.length > 0) {
        setIsAnalyzing(true);
        const vlmStart = Date.now();

        const enhancedPrompt = await callVLM(currentAttachments[0], currentInput);

        const vlmElapsed = Date.now() - vlmStart;
        console.log(`[Pipeline] VLM took ${vlmElapsed}ms`);

        if (enhancedPrompt) {
          finalPrompt = enhancedPrompt;
          // Show what VLM produced
          setMessages((prev) => [...prev, {
            id: generateId(), role: 'assistant',
            content: `🔍 **VLM analyzed your image** (${(vlmElapsed / 1000).toFixed(1)}s)\n\n_Enhanced prompt sent to ${selectedModel.toUpperCase()}..._`,
            timestamp: new Date(),
          }]);
        } else {
          // VLM failed/timed out — continue with raw prompt
          finalPrompt = currentInput || 'Generate an image based on the reference';
          setMessages((prev) => [...prev, {
            id: generateId(), role: 'assistant',
            content: `⚡ VLM analysis skipped — generating directly with ${selectedModel.toUpperCase()}...`,
            timestamp: new Date(),
          }]);
        }
        setIsAnalyzing(false);
      }

      // ── STEP 3: Generate image with user's chosen model ──
      updateAIJob(jobId, { progress: 50 });
      const result = await callGenerate(finalPrompt, selectedModel);

      if (result?.imageUrl && canvas) {
        const layerId = generateId();
        const img = await loadImageToCanvas(canvas as any, result.imageUrl, { layerId });
        addLayer({
          id: layerId, type: 'image', src: result.imageUrl,
          name: `AI: ${currentInput.slice(0, 20) || 'generation'}`,
          width: (img.width || 0) * (img.scaleX || 1),
          height: (img.height || 0) * (img.scaleY || 1),
          x: img.left || 0, y: img.top || 0,
        });
      }

      setMessages((prev) => [...prev, {
        id: generateId(), role: 'assistant',
        content: `🎨 Generated with **${selectedModel.toUpperCase()}**`,
        imageUrl: result?.imageUrl, timestamp: new Date(),
      }]);

      updateAIJob(jobId, { status: 'completed', progress: 100, result });

    } catch (error: any) {
      setMessages((prev) => [...prev, {
        id: generateId(), role: 'assistant',
        content: `❌ ${error.message}`,
        isError: true, timestamp: new Date(),
      }]);
      updateAIJob(jobId, { status: 'failed' });
    } finally {
      setIsProcessing(false);
      setIsAnalyzing(false);
      scrollToBottom();
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="chat-panel-root">
      {/* ── Top Toolbar ── */}
      <div className="chat-panel-toolbar">
        <div className="chat-panel-toolbar-inner">
          {/* Model Selector — user picks generation model */}
          <Select value={aiModel} onValueChange={(v: any) => setAIModel(v)}>
            <SelectTrigger className="chat-model-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="chat-model-content" side="bottom" sideOffset={6}>
              {GENERATION_MODELS.map(m => (
                <SelectItem key={m.value} value={m.value} className="chat-model-item">
                  <span className="chat-model-item-label">{m.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* AI Tools Button */}
          <button
            onClick={() => setToolsModalOpen(true)}
            className="chat-tools-btn"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chat-tools-icon">
              <path d="M12 2l2.4 6.9L21 12l-6.6 3.1L12 22l-2.4-6.9L3 12l6.6-3.1L12 2Z" />
            </svg>
            Tools
          </button>
        </div>
      </div>

      {/* ── Messages Area ── */}
      <div className="chat-panel-messages">
        {messages.length === 0 && (
          <div className="chat-empty-state">
            {/* Animated glow orb */}
            <div className="chat-empty-orb">
              <div className="chat-empty-orb-inner" />
              <div className="chat-empty-orb-ring" />
            </div>
            <div className="chat-empty-text">
              <span className="chat-empty-title">AI Design Studio</span>
              <span className="chat-empty-subtitle">Describe anything — I'll generate it</span>
              <span className="chat-empty-hint">Attach an image for VLM-powered reference analysis</span>
            </div>
            {/* Quick suggestions */}
            <div className="chat-suggestions">
              {['Modern logo', 'Abstract art', 'UI mockup'].map((suggestion) => (
                <button
                  key={suggestion}
                  className="chat-suggestion-chip"
                  onClick={() => setInput(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn(
            "chat-message-row",
            m.role === 'user' ? 'chat-message-user' : 'chat-message-ai'
          )}>
            {/* Avatar */}
            {m.role === 'assistant' && (
              <div className="chat-avatar chat-avatar-ai">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chat-avatar-icon">
                  <path d="M12 2l2.4 6.9L21 12l-6.6 3.1L12 22l-2.4-6.9L3 12l6.6-3.1L12 2Z" />
                </svg>
              </div>
            )}

            <div className={cn(
              "chat-bubble",
              m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai',
              m.isError && 'chat-bubble-error'
            )}>
              {m.content && (
                <p className="chat-bubble-text">{m.content}</p>
              )}
              {m.attachments?.map((url, i) => (
                <img key={i} src={url} className="chat-bubble-attachment" alt="attachment" />
              ))}
              {m.imageUrl && (
                <div className="chat-bubble-generated">
                  <img src={m.imageUrl} className="chat-bubble-image" alt="generated" />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Processing indicator */}
        {(isAnalyzing || isProcessing) && (
          <div className="chat-message-row chat-message-ai">
            <div className="chat-avatar chat-avatar-ai">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chat-avatar-icon chat-avatar-spin">
                <path d="M12 2l2.4 6.9L21 12l-6.6 3.1L12 22l-2.4-6.9L3 12l6.6-3.1L12 2Z" />
              </svg>
            </div>
            <div className="chat-processing">
              <div className="chat-processing-dots">
                <span className="chat-dot" style={{ animationDelay: '0ms' }} />
                <span className="chat-dot" style={{ animationDelay: '150ms' }} />
                <span className="chat-dot" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="chat-processing-label">
                {isAnalyzing ? 'VLM analyzing reference image...' : `Generating with ${aiModel.toUpperCase()}...`}
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ── */}
      <div className="chat-panel-input-area">
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="chat-attachments">
            {attachments.map((url, i) => (
              <div key={i} className="chat-attachment-thumb">
                <img src={url} alt="attachment preview" />
                <button onClick={() => removeAttachment(i)} className="chat-attachment-remove">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2.5 h-2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="chat-input-container">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="chat-input-attach"
            title="Attach reference image for VLM analysis"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4.5 h-4.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>

          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Describe your design..."
            className="chat-input-textarea"
            disabled={isProcessing}
          />

          <button
            onClick={handleSend}
            disabled={(!input.trim() && attachments.length === 0) || isProcessing}
            className={cn(
              "chat-input-send",
              (input.trim() || attachments.length > 0) && !isProcessing
                ? 'chat-input-send-active'
                : 'chat-input-send-idle'
            )}
          >
            {isProcessing ? (
              <span className="chat-input-send-spinner" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                <path d="M6 12L3 21l18-9L3 3l3 9zm0 0h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
