// HuggingFace FLUX Image Generation Script
// This can be used directly in the app or called from other scripts

import { HfInference } from '@huggingface/inference';

export interface HuggingFaceConfig {
  apiKey: string;
  model?: string;
  numInferenceSteps?: number;
}

export async function generateWithHuggingFace(
  prompt: string,
  config: HuggingFaceConfig
): Promise<{ imageUrl: string; buffer: Buffer }> {
  const hf = new HfInference(config.apiKey);
  
  const model = config.model || 'black-forest-labs/FLUX.1-schnell';
  const numInferenceSteps = config.numInferenceSteps || 4;

  const imageBlob = await hf.textToImage({
    model: model,
    inputs: prompt,
    parameters: {
      num_inference_steps: numInferenceSteps,
    }
  }) as unknown as Blob;

  const arrayBuffer = await imageBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64Image = buffer.toString('base64');
  const dataUrl = `data:${imageBlob.type || 'image/jpeg'};base64,${base64Image}`;

  return { imageUrl: dataUrl, buffer };
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const prompt = args[0];
  
  if (!prompt) {
    console.error('Usage: npx ts-node huggingface.ts "your prompt here"');
    process.exit(1);
  }

  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    console.error('HUGGINGFACE_API_KEY environment variable is required');
    process.exit(1);
  }

  generateWithHuggingFace(prompt, { apiKey })
    .then((result) => {
      console.log('Image generated successfully!');
      console.log('Data URL:', result.imageUrl.substring(0, 100) + '...');
    })
    .catch((error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}
