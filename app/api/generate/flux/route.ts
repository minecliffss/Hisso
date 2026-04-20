import { NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

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

    const hf = new HfInference(HF_TOKEN);

    // Try standard FLUX inference
    const imageBlob = await hf.textToImage({
      model: 'black-forest-labs/FLUX.1-schnell',
      inputs: prompt,
      parameters: {
        num_inference_steps: 4,
      }
    }) as unknown as Blob;

    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Generate a data URL to pass back to the client
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${imageBlob.type || 'image/jpeg'};base64,${base64Image}`;

    return NextResponse.json({ success: true, imageUrl: dataUrl });
  } catch (error: any) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate image', details: error.message },
      { status: 500 }
    );
  }
}
