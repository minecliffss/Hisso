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
    const { prompt, model } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const HF_TOKEN = process.env.HUGGINGFACE_API_KEY;

    if (!HF_TOKEN) {
      return NextResponse.json(
        { error: 'HuggingFace API key is not configured.' },
        { status: 500 }
      );
    }

    // Direct mapping to avoid HuggingFace model lookup errors
    const targetModel = MODEL_MAP[model?.toLowerCase()] || model || MODEL_MAP['flux'];
    const isFlux = targetModel.toLowerCase().includes('flux');

    const hf = new HfInference(HF_TOKEN);

    console.log(`Generating with HF model: ${targetModel}`);

    const imageBlob = await hf.textToImage({
      model: targetModel,
      inputs: prompt,
      parameters: {
        num_inference_steps: isFlux ? 4 : 30,
      }
    }) as unknown as Blob;

    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${imageBlob.type || 'image/jpeg'};base64,${base64Image}`;

    return NextResponse.json({ success: true, imageUrl: dataUrl, provider: 'huggingface' });
  } catch (error: any) {
    console.error('HuggingFace generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate image', details: error.message },
      { status: 500 }
    );
  }
}
