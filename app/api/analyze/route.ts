import { NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════════════
// VLM Analysis API — Step 1 of the pipeline
// ═══════════════════════════════════════════════════════════════
// Pipeline: Image + System Prompt + User Prompt → VLM → Enhanced Prompt
//
// This route receives a reference image + user instruction,
// sends them to the VLM (Kimi K2.5 via NVIDIA NIM),
// and returns an enhanced prompt ready for image generation.
//
// The enhanced prompt is then sent to /api/generate with the
// user's chosen generation model (FLUX, SDXL, etc.)
// ═══════════════════════════════════════════════════════════════

// ── Config ──
const VLM_TIMEOUT_MS = 25_000; // 25s timeout for VLM API call

// ── VLM System Prompt ──
// This is the system prompt sent alongside the image + user prompt to the VLM.
// Its job: analyze the image and create a generation-ready prompt.
const VLM_SYSTEM_PROMPT = `You are an expert visual AI assistant. You receive a reference image and a user instruction.

Your job:
1. ANALYZE the reference image — extract: subject, composition, art style, colors, lighting, mood, background, important details.
2. READ the user's instruction — understand what they want to create, modify, or recreate.
3. OUTPUT a single, highly detailed image generation prompt that a text-to-image model (FLUX, SDXL) can use directly.

Rules:
- If the user wants to RECREATE the image: describe everything in the image faithfully — subject, pose, clothing, colors, background, lighting, style — so the generation model can reproduce it.
- If the user wants to MODIFY the image: describe the original image but apply the specific changes they requested.
- If the user gives a creative direction: use the reference as style/composition guidance and create a new prompt.
- Always be specific about colors, lighting direction, composition, and style.
- Keep the prompt under 200 words — concise but detailed.
- Do NOT include meta-instructions like "generate an image of..." — just describe the scene directly.

Respond ONLY with JSON:
{
  "prompt": "The detailed image generation prompt describing the final scene",
  "changes": "Brief note on what was changed vs the reference (or 'faithful recreation')"
}`;

interface VLMRequest {
  image: string;      // Base64 data URL of the reference image
  userPrompt: string; // What the user wants to do with/from this image
  model?: string;     // VLM model to use (default: 'custom' → Kimi K2.5)
}

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const body: VLMRequest = await request.json();
    const { image, userPrompt, model = 'custom' } = body;

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    // ── Resolve VLM credentials ──
    const apiKey = getVLMApiKey(model);
    const baseUrl = getVLMBaseUrl(model);
    const modelName = getVLMModelName(model);

    // No API key → instant fallback (no waiting)
    if (!apiKey) {
      console.log('[VLM] No API key configured, using direct passthrough');
      return NextResponse.json({
        success: true,
        prompt: userPrompt || 'Generate a high quality image based on the reference',
        changes: 'No VLM analysis — API key not configured',
        _fallback: true,
      });
    }

    console.log(`[VLM] Calling ${modelName} via ${baseUrl}`);

    // ── Call VLM with timeout ──
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VLM_TIMEOUT_MS);

    try {
      const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: 'system',
              content: VLM_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: userPrompt
                    ? `User instruction: "${userPrompt}"`
                    : 'Recreate this image with maximum fidelity. Describe every visual detail.',
                },
                {
                  type: 'image_url',
                  image_url: { url: imageUrl },
                },
              ],
            },
          ],
          temperature: 0.3,
          max_tokens: 800,
          response_format: { type: 'json_object' },
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`[VLM] API error ${response.status}: ${errorText.slice(0, 200)}`);
        // Fallback on API error — don't block the pipeline
        return NextResponse.json({
          success: true,
          prompt: userPrompt || 'Generate an image based on the attached reference',
          changes: `VLM returned error ${response.status}, using user prompt directly`,
          _fallback: true,
        });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        console.warn('[VLM] Empty response from model');
        return NextResponse.json({
          success: true,
          prompt: userPrompt || 'Generate an image based on the reference',
          changes: 'VLM returned empty response',
          _fallback: true,
        });
      }

      // Parse VLM response
      let result: { prompt?: string; changes?: string };
      try {
        result = JSON.parse(content);
      } catch {
        // If not JSON, treat the entire response as the prompt
        result = { prompt: content, changes: 'Raw VLM output used as prompt' };
      }

      const elapsed = Date.now() - startTime;
      console.log(`[VLM] Success in ${elapsed}ms — prompt: ${result.prompt?.slice(0, 80)}...`);

      return NextResponse.json({
        success: true,
        prompt: result.prompt || userPrompt,
        changes: result.changes || '',
        vlmModel: modelName,
        elapsed,
      });

    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        const elapsed = Date.now() - startTime;
        console.error(`[VLM] Timed out after ${elapsed}ms`);
        return NextResponse.json({
          success: true,
          prompt: userPrompt || 'Generate an image based on the reference',
          changes: 'VLM timed out, using user prompt directly',
          _fallback: true,
          _reason: 'timeout',
        });
      }

      throw fetchError;
    }

  } catch (error: any) {
    console.error('[VLM] Fatal error:', error);
    return NextResponse.json(
      { error: 'VLM analysis failed', details: error.message },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// VLM Configuration
// ═══════════════════════════════════════════════════════════════

function getVLMApiKey(model: string): string | undefined {
  switch (model.toLowerCase()) {
    case 'kimi':
      return process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY;
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'custom':
    default:
      return process.env.CUSTOM_VISION_API_KEY || process.env.NVIDIA_NIM_API_KEY;
  }
}

function getVLMBaseUrl(model: string): string {
  switch (model.toLowerCase()) {
    case 'custom':
    default:
      const url = process.env.CUSTOM_VISION_BASE_URL || 'https://integrate.api.nvidia.com/v1';
      return url.replace(/\/chat\/completions$/, '');
  }
}

function getVLMModelName(model: string): string {
  switch (model.toLowerCase()) {
    case 'kimi':
      return 'moonshotai/kimi-k2.5';
    case 'openai':
      return 'gpt-4o';
    case 'custom':
    default:
      return process.env.CUSTOM_VISION_MODEL || 'moonshotai/kimi-k2.5';
  }
}
