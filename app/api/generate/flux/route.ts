import { NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';

const MODEL_MAP: Record<string, string> = {
  'flux': 'black-forest-labs/FLUX.1-schnell',
  'sdxl': 'stabilityai/sdxl-turbo',
  'stable-diffusion': 'stabilityai/stable-diffusion-2-1',
  'qwen-image': 'qwen/qwen-image'
};

// Direct generation — no more self-fetch routing overhead
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, model, provider } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const falKey = process.env.FAL_KEY;
    const hfKey = process.env.HUGGINGFACE_API_KEY;

    // Determine provider
    const useProvider = provider || (falKey ? 'falai' : hfKey ? 'huggingface' : null);

    if (!useProvider) {
      return NextResponse.json(
        { error: 'No image generation API key configured. Please set FAL_KEY or HUGGINGFACE_API_KEY.' },
        { status: 500 }
      );
    }

    const targetModel = MODEL_MAP[model?.toLowerCase?.()] || model || MODEL_MAP['flux'];
    const isFlux = targetModel.toLowerCase().includes('flux');

    if (useProvider === 'falai' && falKey) {
      console.log(`[Generate] Using Fal.ai with model: ${targetModel}`);
      return await generateWithFalAi(prompt, targetModel, falKey);
    }

    if (useProvider === 'huggingface' && hfKey) {
      console.log(`[Generate] Using HuggingFace with model: ${targetModel}`);
      return await generateWithHuggingFace(prompt, targetModel, hfKey, isFlux);
    }

    return NextResponse.json(
      { error: `Provider "${useProvider}" is not configured.` },
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

async function generateWithFalAi(prompt: string, modelId: string, apiKey: string) {
  const falModel = modelId.includes('FLUX.1-schnell') ? 'fal-ai/flux/schnell' : 'fal-ai/flux/dev';
  
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
    const errorData = await response.json();
    throw new Error(errorData.message || `Fal.ai API error: ${response.status}`);
  }

  const data = await response.json();
  return NextResponse.json({ 
    success: true, 
    imageUrl: data.images[0].url,
    provider: 'falai'
  });
}

async function generateWithHuggingFace(prompt: string, modelId: string, apiKey: string, isFlux: boolean) {
  const hf = new HfInference(apiKey);

  const imageBlob = await hf.textToImage({
    model: modelId,
    inputs: prompt,
    parameters: {
      num_inference_steps: isFlux ? 4 : 30,
    }
  }) as unknown as Blob;

  const arrayBuffer = await imageBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64Image = buffer.toString('base64');
  const dataUrl = `data:${imageBlob.type || 'image/jpeg'};base64,${base64Image}`;

  return NextResponse.json({ 
    success: true, 
    imageUrl: dataUrl, 
    provider: 'huggingface' 
  });
}
