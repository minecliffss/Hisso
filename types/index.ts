// Hisso AI - Type Definitions

// Editor Tool Types (AI-first, minimal)
export type ToolType =
  | 'select'
  | 'text'
  | 'hand';

// Layer Types
export type LayerType = 'image' | 'text' | 'shape' | 'group';

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  order: number;
  // Transform
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  flipX: boolean;
  flipY: boolean;
  // Content (type-specific)
  src?: string; // For image layers
  text?: string; // For text layers
  fontFamily?: string;
  fontSize?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  letterSpacing?: number;
  lineHeight?: number;
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Blend Modes
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

// History
export interface HistoryState {
  id: string;
  action: string;
  layers: Layer[];
  timestamp: Date;
}

// Project
export interface Project {
  id: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  backgroundColor: string;
  layers: Layer[];
  history: HistoryState[];
  createdAt: Date;
  updatedAt: Date;
}

// Canvas Settings
export interface CanvasSettings {
  width: number;
  height: number;
  backgroundColor: string;
  zoom: number;
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
}

// AI Model Types
export type AIModel = 'qwen-image' | 'flux' | 'sdxl' | 'stable-diffusion';

// AI Types
export type AIJobType =
  | 'text-to-image'
  | 'remove-background'
  | 'upscale'
  | 'inpaint'
  | 'outpaint'
  | 'style-transfer'
  | 'face-enhance';

export type AIJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface AIJob {
  id: string;
  type: AIJobType;
  model: AIModel;
  status: AIJobStatus;
  prompt?: string;
  negativePrompt?: string;
  inputImage?: string;
  resultUrl?: string;
  error?: string;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
}

// Export Types
export type ExportFormat = 'png' | 'jpg' | 'webp' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  quality?: number;
  width?: number;
  height?: number;
  transparent?: boolean;
}

// UI Types — right sidebar tabs
export type RightPanelTab = 'ai' | 'text' | 'layers' | 'export';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

// Filter Types
export interface FilterSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  hue: number;
  sepia: number;
  grayscale: number;
  invert: boolean;
}
