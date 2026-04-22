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

const GENERATION_MODELS: { value: AIModel; label: string; shortLabel: string }[] = [
  { value: 'flux', label: 'FLUX.1 [dev]', shortLabel: 'FLUX' },
  { value: 'sdxl', label: 'SDXL Turbo', shortLabel: 'SDXL' },
  { value: 'qwen-image', label: 'Qwen Image', shortLabel: 'QWEN' },
  { value: 'stable-diffusion', label: 'Stable Diffusion v2', shortLabel: 'SD v2' },
];

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [toolsModalOpen, setToolsModalOpen] = useState(false);
  const [visionModel, setVisionModel] = useState('nvidia');

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

  const currentModelLabel = GENERATION_MODELS.find(m => m.value === aiModel)?.shortLabel || aiModel;

  return (
    <div className="chat-panel-root">
      {/* ── Top Toolbar ── */}
      <div className="chat-panel-toolbar">
        <div className="chat-panel-toolbar-inner">
          {/* Model Selector */}
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
                {isAnalyzing ? 'Analyzing reference...' : 'Creating your design...'}
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
            title="Attach image"
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
