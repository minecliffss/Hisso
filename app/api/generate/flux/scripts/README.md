# FLUX Image Generation Scripts

This folder contains standalone scripts for generating images using different providers.

## Structure

```
scripts/
├── huggingface.ts    # HuggingFace FLUX generation script
├── falai.ts          # Fal.ai FLUX generation script
└── README.md         # This file
```

## Usage

### Using as Modules

Import and use in your application:

```typescript
import { generateWithHuggingFace } from './scripts/huggingface';
import { generateWithFalAI } from './scripts/falai';

// HuggingFace
const result = await generateWithHuggingFace('A beautiful sunset', {
  apiKey: process.env.HUGGINGFACE_API_KEY!,
  numInferenceSteps: 4
});

// Fal.ai
const result = await generateWithFalAI('A beautiful sunset', {
  apiKey: process.env.FAL_KEY!,
  width: 1024,
  height: 768
});
```

### Command Line Usage

```bash
# HuggingFace
HUGGINGFACE_API_KEY=your_key npx ts-node huggingface.ts "A beautiful sunset"

# Fal.ai
FAL_KEY=your_key npx ts-node falai.ts "A beautiful sunset"
```

## Providers

### HuggingFace
- **Model**: `black-forest-labs/FLUX.1-schnell`
- **Speed**: Fast (4 inference steps)
- **Quality**: Good for quick generations
- **Pricing**: Free tier available

### Fal.ai
- **Model**: `fal-ai/flux/dev`
- **Speed**: Medium (28 inference steps)
- **Quality**: High quality
- **Pricing**: Pay per use

## Environment Variables

Create a `.env` file in the project root:

```
# Pick one or configure both
HUGGINGFACE_API_KEY=hf_your_token_here
FAL_KEY=fal_your_key_here
```

## API Routes

The main API route (`/api/generate/flux`) automatically detects which provider to use based on available API keys:

- If `FAL_KEY` exists → Uses Fal.ai
- Else if `HUGGINGFACE_API_KEY` exists → Uses HuggingFace
- Else → Returns error

You can also explicitly specify the provider:

```typescript
// Auto-detect
fetch('/api/generate/flux', {
  method: 'POST',
  body: JSON.stringify({ prompt: 'A cat' })
});

// Explicit provider
fetch('/api/generate/flux', {
  method: 'POST',
  body: JSON.stringify({ prompt: 'A cat', provider: 'falai' })
});
```

## Direct Provider Routes

You can also call provider-specific routes directly:

- `POST /api/generate/flux/huggingface` - HuggingFace only
- `POST /api/generate/flux/falai` - Fal.ai only
