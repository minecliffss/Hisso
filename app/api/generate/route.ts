import { NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';

const MODEL_MAP: Record<string, string> = {
  'flux': 'black-forest-labs/FLUX.1-schnell',
  'sdxl': 'stabilityai/sdxl-turbo',
  'stable-diffusion': 'stabilityai/stable-diffusion-2-1',
  'qwen-image': 'qwen/qwen-image'
};

export async function POST(request: Request) {
  try {
    const { prompt, model, provider } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const targetModelId = MODEL_MAP[model] || model || MODEL_MAP['flux'];
    const isFlux = targetModelId.toLowerCase().includes('flux');

    // Priority 1: Fal.ai (if FAL_KEY exists and not explicitly HuggingFace)
    const falKey = process.env.FAL_KEY;
    if (falKey && provider !== 'huggingface') {
       return await generateWithFalAi(prompt, targetModelId, falKey);
    }

    // Priority 2: HuggingFace (if HUGGINGFACE_API_KEY exists)
    const hfKey = process.env.HUGGINGFACE_API_KEY;
    if (hfKey) {
        return await generateWithHuggingFace(prompt, targetModelId, hfKey, isFlux);
    }

    return NextResponse.json(
      { error: 'No image generation API key configured. Please set FAL_KEY or HUGGINGFACE_API_KEY.' },
      { status: 500 }
    );

  } catch (error: any) {
    console.error('Unified generation error:', error);
    return NextResponse.json(
      { error: 'Generation failed', details: error.message },
      { status: 500 }
    );
  }
}

async function generateWithFalAi(prompt: string, modelId: string, apiKey: string) {
    // Note: Fal.ai often requires its own model path format
    // Map our common model IDs to Fal.ai if necessary, but we'll try direct or default to flux
    const falModel = modelId.includes('FLUX.1-schnell') ? 'fal-ai/flux/schnell' : 'fal-ai/flux/dev';
    
    const response = await fetch('https://api.fal.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: falModel,
        prompt: prompt,
        image_size: { width: 1024, height: 768 },
        num_inference_steps: 28,
        guidance_scale: 3.5,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Fal.ai API error');
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
