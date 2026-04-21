import { NextResponse } from 'next/server';

// OpenAI-compatible image analysis API
// Supports: Kimi (Moonshot AI), Gemma, OpenAI, or any OpenAI-compatible endpoint

interface AnalysisRequest {
  image: string; // Base64 encoded image
  userPrompt: string;
  mode: 'analyze-only' | 'analyze-and-generate' | 'reference-style';
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// System prompt for detailed image analysis
const ANALYSIS_SYSTEM_PROMPT = `You are an expert image analyzer with exceptional attention to detail. Your task is to analyze images thoroughly and provide comprehensive descriptions.

When analyzing an image, extract and describe:
1. SUBJECT: Main subject(s) in the image, what they are doing
2. COMPOSITION: How elements are arranged, framing, rule of thirds
3. CAMERA ANGLE: Perspective (eye-level, low angle, high angle, etc.)
4. POSE: Body positioning, posture, gestures
5. FACIAL EXPRESSION: If applicable - emotion shown
6. CLOTHING: Detailed description of attire, textures, patterns
7. COLORS: Primary color palette, dominant colors, color harmony
8. LIGHTING: Type (natural, artificial), direction, quality (soft, harsh), shadows
9. BACKGROUND: Environment, setting, depth of field
10. ART STYLE: Photorealistic, illustration, painting style, digital art
11. REALISM LEVEL: Hyper-realistic, realistic, stylized, cartoon, abstract
12. ASPECT RATIO: Image dimensions relative to content
13. IMPORTANT OBJECTS: Key items, props, elements
14. TEXT IN IMAGE: Any visible text, signs, labels
15. MOOD: Emotional atmosphere, feeling conveyed
16. PERSPECTIVE: Spatial depth, vanishing points
17. PROPORTIONS: Scale relationships between elements
18. COLOR PALETTE: Specific hex-like color descriptions

For image recreation requests, emphasize:
- Exact visual elements to preserve
- Style characteristics
- Technical aspects (lighting, composition)
- What should remain identical vs what can change

Respond in JSON format with these exact keys:
{
  "subject": "...",
  "composition": "...",
  "cameraAngle": "...",
  "pose": "...",
  "facialExpression": "...",
  "clothing": "...",
  "colors": ["color1", "color2", ...],
  "lighting": "...",
  "background": "...",
  "artStyle": "...",
  "realismLevel": "...",
  "aspectRatio": "...",
  "importantObjects": ["object1", "object2", ...],
  "textInImage": "...",
  "mood": "...",
  "perspective": "...",
  "proportions": "...",
  "colorPalette": "...",
  "detailedDescription": "Full comprehensive description..."
}`;

// Prompt for combining analysis with user request
const COMBINE_PROMPT_TEMPLATE = `Based on the image analysis below and the user's request, create a detailed prompt for image generation that preserves the reference image's identity while incorporating requested changes.

IMAGE ANALYSIS:
{{ANALYSIS}}

USER REQUEST:
"{{USER_PROMPT}}"

TASK:
1. If user wants to recreate/remake/copy the image: Create a prompt that maintains maximum fidelity to the reference image
2. If user requests changes: Keep everything identical EXCEPT the requested changes
3. If user adds new elements: Preserve original + add new elements naturally

Generate a detailed FLUX-compatible prompt that:
- Describes the scene with the same composition and framing
- Maintains the art style and realism level
- Preserves colors, lighting, and mood
- Includes specific details about subjects, clothing, objects
- Maintains aspect ratio and perspective
- Incorporates any requested modifications

OUTPUT FORMAT:
Return a JSON object with:
{
  "combinedPrompt": "The complete detailed prompt for image generation",
  "keyElements": ["list of critical elements to preserve"],
  "suggestedChanges": ["specific modifications to make"],
  "styleNotes": "Notes about maintaining style consistency"
}`;

// System prompt for single-step analysis and prompt mixing
const UNIFIED_ANALYSIS_PROMPT = `You are an expert AI designer. Your task is to analyze an input image AND a user instruction, then create a single, highly detailed prompt for a high-end image generator (like FLUX or SDXL).

INSTRUCTIONS:
1. Analyze the reference image: Extract style, composition, subjects, lighting, and colors.
2. Consider the user's request: How should the reference be modified or used?
3. Generate a UNIFIED prompt: Create a comprehensive description that preserves the core identity of the reference while incorporating the user's instructions.

If the user wants a recreation, focus on maximum fidelity.
If the user wants changes, specify exactly what to change while keeping everything else identical.

Respond in JSON format:
{
  "combinedPrompt": "The final detailed prompt for image generation",
  "analysis": {
    "subject": "Description of subjects",
    "style": "Art style details",
    "colors": "Color palette"
  }
}`;

export async function POST(request: Request) {
  try {
    const body: AnalysisRequest = await request.json();
    const { image, userPrompt, mode, model = 'kimi', temperature = 0.7, maxTokens = 2000 } = body;

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    const apiKey = getApiKey(model);
    const baseUrl = getBaseUrl(model);

    if (!apiKey) {
      const fallbackAnalysis = generateFallbackAnalysis(userPrompt, image);
      return NextResponse.json({ success: true, ...fallbackAnalysis });
    }

    // SINGLE-STEP: Analyze and Mix in one call
    const modelName = getVisionModelName(model);
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: UNIFIED_ANALYSIS_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `USER REQUEST: "${userPrompt || 'Recreate this image with high fidelity'}"\n\nPlease analyze the attached image and generate a mixed prompt based on this request.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`,
                },
              },
            ],
          },
        ],
        temperature: 0.4,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0]?.message?.content || '{}');

    return NextResponse.json({
      success: true,
      combinedPrompt: result.combinedPrompt || buildEnhancedPrompt({}, userPrompt),
      analysis: result.analysis || {},
      mode,
    });

  } catch (error: any) {
    console.error('Unified Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to process image/prompt mix', details: error.message },
      { status: 500 }
    );
  }
}

// Fallback analysis when no AI vision API is available
function generateFallbackAnalysis(userPrompt: string, imageData: string) {
  // Extract basic info from the prompt
  const isRecreate = /recreate|remake|copy|similar|like this|based on/i.test(userPrompt);
  
  const analysis = {
    subject: isRecreate ? 'Image subject (preserving from reference)' : 'Image subject',
    composition: isRecreate ? 'Original composition preserved' : 'Standard composition',
    cameraAngle: 'Eye level',
    pose: 'Natural pose',
    facialExpression: '',
    clothing: '',
    colors: ['preserved from reference'],
    lighting: 'Natural lighting',
    background: 'Preserved from reference image',
    artStyle: isRecreate ? 'Matching reference style' : 'Photorealistic',
    realismLevel: 'Realistic',
    aspectRatio: '1:1',
    importantObjects: [],
    textInImage: '',
    mood: 'Preserved from reference',
    perspective: 'Standard perspective',
    proportions: 'Natural proportions',
    colorPalette: 'Matching reference colors',
    detailedDescription: 'Using reference image for style and composition guidance',
  };

  const combinedPrompt = buildEnhancedPrompt(analysis, userPrompt);

  return {
    analysis,
    combinedPrompt,
    keyElements: ['subject', 'composition', 'style', 'colors'],
    suggestedChanges: userPrompt ? [userPrompt] : [],
    styleNotes: 'Using reference image as primary guide. Add Kimi/OpenAI/Gemma API key for detailed analysis.',
  };
}

// Build enhanced prompt from analysis + user request
function buildEnhancedPrompt(analysis: any, userPrompt: string): string {
  if (!userPrompt || userPrompt.trim() === '') {
    return analysis.detailedDescription || 'Generate an image based on the reference';
  }

  const isRecreate = /recreate|remake|copy|similar|like this|based on/i.test(userPrompt);
  
  if (isRecreate) {
    return `[REFERENCE-BASED GENERATION]

User attached a reference image and wants: "${userPrompt}"

GENERATION INSTRUCTIONS:
- Use the reference image as the PRIMARY source of truth
- Recreate with maximum fidelity to the original image
- Preserve all visual elements: subject, pose, composition, colors, lighting, background, style
- Make ONLY the specific changes requested by the user
- Maintain the same framing, perspective, and proportions
- Keep the color palette consistent unless user asks for changes
- Match the art style and realism level exactly

The reference image contains all the visual information needed. Analyze it carefully and reproduce faithfully while applying: ${userPrompt}

Generate a high-quality image that matches the reference while incorporating the requested modifications.`.trim();
  }

  return `[Using reference image]

${userPrompt}

Style guidance: ${analysis.artStyle || 'Photorealistic'}, ${analysis.lighting || 'natural lighting'}, ${analysis.mood || 'balanced mood'}

Generate based on user request while considering the reference image.`;
}

function getApiKey(model: string): string | undefined {
  switch (model.toLowerCase()) {
    case 'kimi':
      return process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY;
    case 'gemma':
      return process.env.GEMMA_API_KEY;
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'nvidia':
    case 'nvidia-nim':
      return process.env.NVIDIA_NIM_API_KEY;
    case 'custom':
      return process.env.CUSTOM_VISION_API_KEY || process.env.NVIDIA_NIM_API_KEY;
    default:
      return process.env.OPENAI_API_KEY || process.env.NVIDIA_NIM_API_KEY;
  }
}

function getBaseUrl(model: string): string {
  switch (model.toLowerCase()) {
    case 'custom':
      const url = process.env.CUSTOM_VISION_BASE_URL || 'https://integrate.api.nvidia.com/v1';
      return url.replace(/\/chat\/completions$/, '');
    default:
      return 'https://integrate.api.nvidia.com/v1';
  }
}

async function analyzeImage(
  imageBase64: string,
  apiKey: string,
  baseUrl: string,
  model: string,
  temperature: number,
  maxTokens: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  const modelName = getVisionModelName(model);
  
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: ANALYSIS_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this image in detail. Provide a comprehensive JSON response with all the requested fields.',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    return { 
      success: false, 
      error: errorData.error?.message || `API error: ${response.status}` 
    };
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  if (!content) {
    return { success: false, error: 'No content in response' };
  }

  try {
    const parsed = JSON.parse(content);
    return { success: true, data: parsed };
  } catch (e) {
    // If not valid JSON, return the text as detailedDescription
    return { 
      success: true, 
      data: { detailedDescription: content } 
    };
  }
}

async function combineAnalysisWithPrompt(
  analysis: any,
  userPrompt: string,
  apiKey: string,
  baseUrl: string,
  model: string,
  temperature: number,
  maxTokens: number
): Promise<any> {
  const modelName = getTextModelName(model);
  
  const analysisText = JSON.stringify(analysis, null, 2);
  const promptContent = COMBINE_PROMPT_TEMPLATE
    .replace('{{ANALYSIS}}', analysisText)
    .replace('{{USER_PROMPT}}', userPrompt);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: 'You are a prompt engineering expert. Create detailed, FLUX-compatible image generation prompts.',
        },
        {
          role: 'user',
          content: promptContent,
        },
      ],
      temperature: temperature * 0.8, // Slightly lower temp for consistency
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to combine analysis with prompt');
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content in combination response');
  }

  try {
    return JSON.parse(content);
  } catch (e) {
    return {
      combinedPrompt: content,
      keyElements: [],
      suggestedChanges: [],
      styleNotes: '',
    };
  }
}

function getVisionModelName(model: string): string {
  switch (model.toLowerCase()) {
    case 'kimi':
      return 'moonshotai/kimi-k2.5';
    case 'gemma':
      return 'gemma-3-27b-it';
    case 'openai':
      return 'gpt-4o-vision';
    case 'nvidia':
    case 'nvidia-nim':
      return process.env.NVIDIA_NIM_VISION_MODEL || 'moonshotai/kimi-k2.5';
    case 'custom':
      return process.env.CUSTOM_VISION_MODEL || process.env.NVIDIA_NIM_VISION_MODEL || 'gpt-4o-vision';
    default:
      return process.env.NVIDIA_NIM_VISION_MODEL || 'gpt-4o-vision';
  }
}

function getTextModelName(model: string): string {
  switch (model.toLowerCase()) {
    case 'kimi':
      return 'moonshotai/kimi-k2.5';
    case 'gemma':
      return 'gemma-3-27b-it';
    case 'openai':
      return 'gpt-4o';
    case 'nvidia':
    case 'nvidia-nim':
      return process.env.NVIDIA_NIM_TEXT_MODEL || 'moonshotai/kimi-k2.5';
    case 'custom':
      return process.env.CUSTOM_TEXT_MODEL || process.env.NVIDIA_NIM_TEXT_MODEL || 'gpt-4o';
    default:
      return process.env.NVIDIA_NIM_TEXT_MODEL || 'gpt-4o';
  }
}
