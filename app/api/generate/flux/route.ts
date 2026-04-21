import { NextResponse } from 'next/server';

// This route acts as a router to determine which provider to use
// Priority: Fal.ai (if FAL_KEY exists) > HuggingFace (if HUGGINGFACE_API_KEY exists)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, ...restBody } = body;

    // If provider is explicitly specified, use it
    if (provider === 'falai') {
      return forwardToProvider('falai', restBody);
    } else if (provider === 'huggingface') {
      return forwardToProvider('huggingface', restBody);
    }

    // Auto-detect based on available API keys
    const falKey = process.env.FAL_KEY;
    const hfKey = process.env.HUGGINGFACE_API_KEY;

    if (falKey) {
      console.log('Using Fal.ai provider (FAL_KEY detected)');
      return forwardToProvider('falai', restBody);
    } else if (hfKey) {
      console.log('Using HuggingFace provider (HUGGINGFACE_API_KEY detected)');
      return forwardToProvider('huggingface', restBody);
    } else {
      return NextResponse.json(
        { error: 'No image generation API key configured. Please set FAL_KEY or HUGGINGFACE_API_KEY.' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Flux generation router error:', error);
    return NextResponse.json(
      { error: 'Failed to route request', details: error.message },
      { status: 500 }
    );
  }
}

async function forwardToProvider(provider: 'falai' | 'huggingface', body: any) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const targetUrl = `${baseUrl}/api/generate/flux/${provider}`;

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
