// Image Analysis Service
// Uses AI models (Kimi, Gemma, OpenAI) to analyze reference images

import type { AnalysisResult, ImageAnalysis, ReferenceImageWorkflow } from '@/types';

export interface AnalyzeImageOptions {
  image: string; // Base64 or data URL
  userPrompt: string;
  mode: 'analyze-only' | 'analyze-and-generate' | 'reference-style';
  model?: 'kimi' | 'gemma' | 'openai' | 'custom';
  temperature?: number;
  maxTokens?: number;
}

export interface AnalyzeImageResult {
  success: boolean;
  analysis?: ImageAnalysis;
  combinedPrompt?: string;
  keyElements?: string[];
  suggestedChanges?: string[];
  styleNotes?: string;
  error?: string;
}

/**
 * Analyze a reference image using AI vision models
 */
export async function analyzeReferenceImage(
  options: AnalyzeImageOptions
): Promise<AnalyzeImageResult> {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze image');
    }

    const data = await response.json();
    
    return {
      success: true,
      analysis: data.analysis,
      combinedPrompt: data.combinedPrompt,
      keyElements: data.keyElements,
      suggestedChanges: data.suggestedChanges,
      styleNotes: data.styleNotes,
    };
  } catch (error: any) {
    console.error('Analysis service error:', error);
    return {
      success: false,
      error: error.message || 'Failed to analyze image',
    };
  }
}

/**
 * Build a complete workflow for reference-based generation
 */
export async function buildReferenceWorkflow(
  referenceImage: string,
  userPrompt: string,
  analysisModel: 'kimi' | 'gemma' | 'openai' | 'custom' = 'kimi'
): Promise<ReferenceImageWorkflow & { success: boolean; error?: string }> {
  try {
    // Step 1: Analyze the reference image
    const analysisResult = await analyzeReferenceImage({
      image: referenceImage,
      userPrompt,
      mode: 'reference-style',
      model: analysisModel,
    });

    if (!analysisResult.success) {
      throw new Error(analysisResult.error || 'Analysis failed');
    }

    // Step 2: Return the complete workflow
    return {
      success: true,
      referenceImage,
      analysisResult: {
        analysis: analysisResult.analysis!,
        combinedPrompt: analysisResult.combinedPrompt || '',
        suggestedChanges: analysisResult.suggestedChanges,
      },
      userModifications: userPrompt,
      finalPrompt: analysisResult.combinedPrompt || userPrompt,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      referenceImage,
      finalPrompt: userPrompt,
    };
  }
}

/**
 * Extract base64 from data URL
 */
export function extractBase64FromDataUrl(dataUrl: string): string {
  const base64Index = dataUrl.indexOf('base64,');
  if (base64Index !== -1) {
    return dataUrl.substring(base64Index + 7);
  }
  return dataUrl;
}

/**
 * Check if analysis model is configured
 */
export function isAnalysisModelConfigured(model: string): boolean {
  const apiKey = getAnalysisApiKey(model);
  return !!apiKey;
}

function getAnalysisApiKey(model: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  
  switch (model.toLowerCase()) {
    case 'kimi':
      return process.env.NEXT_PUBLIC_KIMI_API_KEY || undefined;
    case 'gemma':
      return process.env.NEXT_PUBLIC_GEMMA_API_KEY || undefined;
    case 'openai':
      return process.env.NEXT_PUBLIC_OPENAI_API_KEY || undefined;
    default:
      return undefined;
  }
}

/**
 * Format analysis for display
 */
export function formatAnalysisForDisplay(analysis: ImageAnalysis): string {
  const sections = [
    { label: 'Subject', value: analysis.subject },
    { label: 'Composition', value: analysis.composition },
    { label: 'Camera Angle', value: analysis.cameraAngle },
    { label: 'Pose', value: analysis.pose },
    { label: 'Lighting', value: analysis.lighting },
    { label: 'Background', value: analysis.background },
    { label: 'Art Style', value: analysis.artStyle },
    { label: 'Mood', value: analysis.mood },
  ];

  return sections
    .filter(s => s.value)
    .map(s => `**${s.label}**: ${s.value}`)
    .join('\n');
}

/**
 * Generate preview of what will change vs what stays same
 */
export function generateChangePreview(
  analysis: ImageAnalysis,
  userModifications: string
): { preserved: string[]; changed: string[] } {
  const preserved: string[] = [];
  const changed: string[] = [];

  // Basic logic: if user mentions changing something, it's changed
  const userLower = userModifications.toLowerCase();
  
  if (analysis.subject && !userLower.includes('change subject')) {
    preserved.push(`Subject: ${analysis.subject}`);
  } else if (userLower.includes('change subject')) {
    changed.push('Subject will be modified');
  }

  if (analysis.background && !userLower.includes('background')) {
    preserved.push(`Background: ${analysis.background}`);
  } else if (userLower.includes('background')) {
    changed.push('Background will be modified');
  }

  if (analysis.colors && !userLower.includes('color')) {
    preserved.push(`Color palette preserved`);
  } else if (userLower.includes('color')) {
    changed.push('Colors will be modified');
  }

  if (analysis.lighting && !userLower.includes('light')) {
    preserved.push(`Lighting: ${analysis.lighting}`);
  } else if (userLower.includes('light')) {
    changed.push('Lighting will be modified');
  }

  return { preserved, changed };
}
