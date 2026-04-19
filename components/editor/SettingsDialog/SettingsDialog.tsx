'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SettingsDialogProps {
  onClose: () => void;
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* AI Provider Integrations */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">AI Providers</h3>

            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">OpenAI API Key</label>
                <Input type="password" placeholder="sk-..." className="w-full" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Stability AI API Key</label>
                <Input type="password" placeholder="sk-..." className="w-full" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Replicate API Token</label>
                <Input type="password" placeholder="r8_..." className="w-full" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Model Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Default Models</h3>

            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Image Generation Model</label>
                <Select defaultValue="qwen-image">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qwen-image">Qwen Image</SelectItem>
                    <SelectItem value="flux">FLUX</SelectItem>
                    <SelectItem value="sdxl">SDXL</SelectItem>
                    <SelectItem value="stable-diffusion">Stable Diffusion</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Upscale Model</label>
                <Select defaultValue="real-esrgan">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="real-esrgan">Real-ESRGAN</SelectItem>
                    <SelectItem value="swinir">SwinIR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Advanced */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Advanced</h3>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-save</p>
                <p className="text-xs text-muted-foreground">Save projects automatically</p>
              </div>
              <Button variant="outline" size="sm">Enabled</Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">GPU Acceleration</p>
                <p className="text-xs text-muted-foreground">Use GPU for AI processing</p>
              </div>
              <Button variant="outline" size="sm">Auto</Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={onClose}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
