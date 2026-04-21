// Fal.ai FLUX Image Generation Script
// This can be used directly in the app or called from other scripts

export interface FalAIConfig {
  apiKey: string;
  width?: number;
  height?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
  model?: string;
}

export interface FalAIResponse {
  images: Array<{ url: string }>;
  seed?: number;
  has_nsfw_concepts?: boolean[];
}

export async function generateWithFalAI(
  prompt: string,
  config: FalAIConfig
): Promise<{ imageUrl: string; response: FalAIResponse }> {
  const width = config.width || 1024;
  const height = config.height || 768;
  const numInferenceSteps = config.numInferenceSteps || 28;
  const guidanceScale = config.guidanceScale || 3.5;
  const model = config.model || 'fal-ai/flux/dev';

  const response = await fetch('https://api.fal.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      prompt: prompt,
      image_size: { width, height },
      num_inference_steps: numInferenceSteps,
      guidance_scale: guidanceScale,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `Fal.ai API error: ${response.status}`);
  }

  const data: FalAIResponse = await response.json();
  
  return { 
    imageUrl: data.images[0].url,
    response: data
  };
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const prompt = args[0];
  
  if (!prompt) {
    console.error('Usage: npx ts-node falai.ts "your prompt here"');
    process.exit(1);
  }

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    console.error('FAL_KEY environment variable is required');
    process.exit(1);
  }

  generateWithFalAI(prompt, { apiKey })
    .then((result) => {
      console.log('Image generated successfully!');
      console.log('Image URL:', result.imageUrl);
    })
    .catch((error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}
