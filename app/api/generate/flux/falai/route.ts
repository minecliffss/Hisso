import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { prompt, model } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const FAL_KEY = process.env.FAL_KEY;

    if (!FAL_KEY) {
      return NextResponse.json(
        { error: 'Fal.ai API key is not configured.' },
        { status: 500 }
      );
    }

    // Mapping short names to full Fal.ai model IDs
    const modelMap: Record<string, string> = {
      'flux': 'fal-ai/flux/dev',
      'sdxl': 'fal-ai/fast-sdxl',
    };

    const targetModel = modelMap[model] || model || modelMap['flux'];

    // Using Fal.ai API
    const response = await fetch('https://api.fal.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: targetModel,
        prompt: prompt,
        image_size: 'square_hd',
        num_inference_steps: 28,
        guidance_scale: 3.5,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Fal.ai API error');
    }

    const data = await response.json();
    
    // Fal.ai returns the image URL directly
    return NextResponse.json({ 
      success: true, 
      imageUrl: data.images[0].url,
      provider: 'falai'
    });
  } catch (error: any) {
    console.error('Fal.ai generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate image', details: error.message },
      { status: 500 }
    );
  }
}
