import { NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';

// ═══════════════════════════════════════════════════════════════
// Unified Image Generation API
// ═══════════════════════════════════════════════════════════════
// Pipeline: VLM enhanced prompt (from /api/analyze) → this route → generated image
//
// Supported models (user selects in ChatPanel):
//   - flux        → FLUX.1 schnell (HuggingFace / Fal.ai)
//   - sdxl        → SDXL Turbo (HuggingFace)
//   - stable-diffusion → SD v2.1 (HuggingFace)
// ═══════════════════════════════════════════════════════════════

const MODEL_MAP: Record<string, string> = {
  'flux':              'black-forest-labs/FLUX.1-schnell',
  'sdxl':              'stabilityai/sdxl-turbo',
  'stable-diffusion':  'stabilityai/stable-diffusion-2-1',
};

export async function POST(request: Request) {
  try {
    const { prompt, model = 'flux' } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Resolve the HuggingFace model ID from user's selection
    const modelKey = model?.toLowerCase?.() || 'flux';
    const targetModel = MODEL_MAP[modelKey] || MODEL_MAP['flux'];
    const isFlux = targetModel.toLowerCase().includes('flux');

    console.log(`[Generate] Model: ${modelKey} → ${targetModel}`);
    console.log(`[Generate] Prompt: ${prompt.slice(0, 120)}...`);

    // ── Provider selection ──
    // Priority: Fal.ai (fast, if key exists) > HuggingFace (free tier)
    const falKey = process.env.FAL_KEY;
    const hfKey = process.env.HUGGINGFACE_API_KEY;

    if (falKey && isFlux) {
      // Fal.ai only supports FLUX models well
      return await generateWithFalAi(prompt, targetModel, falKey);
    }

    if (hfKey) {
      return await generateWithHuggingFace(prompt, targetModel, hfKey, isFlux);
    }

    return NextResponse.json(
      { error: 'No image generation API key configured. Set HUGGINGFACE_API_KEY in .env' },
      { status: 500 }
    );

  } catch (error: any) {
    console.error('[Generate] Error:', error);
    return NextResponse.json(
      { error: 'Generation failed', details: error.message },
      { status: 500 }
    );
  }
}

// ── Fal.ai provider (FLUX only) ──
async function generateWithFalAi(prompt: string, modelId: string, apiKey: string) {
  const falModel = modelId.includes('FLUX.1-schnell')
    ? 'fal-ai/flux/schnell'
    : 'fal-ai/flux/dev';

  const response = await fetch('https://api.fal.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: falModel,
      prompt,
      image_size: { width: 1024, height: 768 },
      num_inference_steps: 28,
      guidance_scale: 3.5,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Fal.ai API error: ${response.status}`);
  }

  const data = await response.json();
  return NextResponse.json({
    success: true,
    imageUrl: data.images[0].url,
    provider: 'falai',
    model: modelId,
  });
}

// ── HuggingFace provider (all models) ──
async function generateWithHuggingFace(
  prompt: string,
  modelId: string,
  apiKey: string,
  isFlux: boolean
) {
  const hf = new HfInference(apiKey);

  const imageBlob = await hf.textToImage({
    model: modelId,
    inputs: prompt,
    parameters: {
      num_inference_steps: isFlux ? 4 : 30,
    },
  }) as unknown as Blob;

  const arrayBuffer = await imageBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64Image = buffer.toString('base64');
  const dataUrl = `data:${imageBlob.type || 'image/jpeg'};base64,${base64Image}`;

  return NextResponse.json({
    success: true,
    imageUrl: dataUrl,
    provider: 'huggingface',
    model: modelId,
  });
}
