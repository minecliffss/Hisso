'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ToolType, Layer, HistoryState, AIModel, AIJob, AIJobType, RightPanelTab } from '@/types';
import { generateId, deepClone } from '@/lib/utils/helpers';

// Fabric.js type stub
interface FabricObject {
  id?: string;
  type: string;
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  flipX: boolean;
  flipY: boolean;
  opacity: number;
  visible: boolean;
  selectable: boolean;
  evented: boolean;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  src?: string;
  set: (props: Partial<FabricObject>) => void;
  toObject: () => Record<string, any>;
  clone: (callback: (clone: FabricObject) => void) => void;
}

interface FabricCanvas {
  width: number;
  height: number;
  backgroundColor: string;
  selection: boolean;
  preserveObjectStacking: boolean;
  _objects: FabricObject[];
  add: (object: FabricObject) => FabricCanvas;
  remove: (object: FabricObject) => FabricCanvas;
  clear: () => FabricCanvas;
  renderAll: () => FabricCanvas;
  setActiveObject: (object: FabricObject) => FabricCanvas;
  discardActiveObject: () => FabricCanvas;
  getActiveObject: () => FabricObject | null;
  getObjects: () => FabricObject[];
  setZoom: (zoom: number) => void;
  getZoom: () => number;
  setDimensions: (dims: { width: number; height: number }) => void;
  toDataURL: (options?: { format?: string; quality?: number; multiplier?: number }) => string;
  on: (event: string, handler: (e: any) => void) => void;
  off: (event: string, handler: (e: any) => void) => void;
}

// Editor State Interface
interface EditorState {
  // Canvas reference
  canvas: FabricCanvas | null;

  // Canvas settings
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  zoom: number;
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;

  // Tools (minimal — select, text, hand)
  activeTool: ToolType;

  // Theme
  isDark: boolean;

  // Selection
  selectedObject: FabricObject | null;
  selectedLayerId: string | null;

  // Layers
  layers: Layer[];

  // History
  history: HistoryState[];
  historyIndex: number;
  maxHistory: number;

  // AI
  activeRightTab: RightPanelTab;
  aiModel: AIModel;
  aiPrompt: string;
  aiNegativePrompt: string;
  isGenerating: boolean;
  aiJobs: AIJob[];

  // Export
  exportFormat: 'png' | 'jpg' | 'webp';
  exportQuality: number;
}

// Editor Actions Interface
interface EditorActions {
  // Canvas
  setCanvas: (canvas: FabricCanvas) => void;
  setCanvasSize: (width: number, height: number) => void;
  setBackgroundColor: (color: string) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  toggleGrid: () => void;
  setGridSize: (size: number) => void;
  toggleSnapToGrid: () => void;

  // Tools
  setActiveTool: (tool: ToolType) => void;

  // Theme
  toggleTheme: () => void;

  // Selection
  setSelectedObject: (obj: FabricObject | null) => void;
  setSelectedLayerId: (id: string | null) => void;
  clearSelection: () => void;

  // Layers
  addLayer: (layer: Partial<Layer>) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  deleteLayer: (id: string) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  setLayerOpacity: (id: string, opacity: number) => void;

  // History
  saveHistory: (action: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;

  // AI
  setActiveRightTab: (tab: RightPanelTab) => void;
  setAIModel: (model: AIModel) => void;
  setAIPrompt: (prompt: string) => void;
  setAINegativePrompt: (prompt: string) => void;
  setIsGenerating: (generating: boolean) => void;
  addAIJob: (job: AIJob) => void;
  updateAIJob: (id: string, updates: Partial<AIJob>) => void;

  // Export
  setExportFormat: (format: 'png' | 'jpg' | 'webp') => void;
  setExportQuality: (quality: number) => void;
}

// Combined Store Type
type EditorStore = EditorState & EditorActions;

// Initial State
const initialState: EditorState = {
  canvas: null,
  canvasWidth: 1920,
  canvasHeight: 1080,
  backgroundColor: '#1a1a1a',
  zoom: 1,
  showGrid: false,
  gridSize: 20,
  snapToGrid: false,
  activeTool: 'select',
  isDark: true,
  selectedObject: null,
  selectedLayerId: null,
  layers: [],
  history: [],
  historyIndex: -1,
  maxHistory: 50,
  activeRightTab: 'ai',
  aiModel: 'qwen-image',
  aiPrompt: '',
  aiNegativePrompt: '',
  isGenerating: false,
  aiJobs: [],
  exportFormat: 'png',
  exportQuality: 0.9,
};

// Create Store with Immer
export const useEditorStore = create<EditorStore>()(
  immer((set, get) => ({
    ...initialState,

    // Canvas Actions
    setCanvas: (canvas) => set({ canvas }),

    setCanvasSize: (width, height) => {
      const { canvas } = get();
      if (canvas) {
        canvas.setDimensions({ width, height });
        canvas.renderAll();
      }
      set({ canvasWidth: width, canvasHeight: height });
    },

    setBackgroundColor: (color) => {
      const { canvas } = get();
      if (canvas) {
        canvas.backgroundColor = color;
        canvas.renderAll();
      }
      set({ backgroundColor: color });
    },

    setZoom: (zoom) => {
      const { canvas } = get();
      if (canvas) {
        canvas.setZoom(zoom);
        canvas.renderAll();
      }
      set({ zoom });
    },

    zoomIn: () => {
      const { zoom, setZoom } = get();
      setZoom(Math.min(zoom * 1.2, 5));
    },

    zoomOut: () => {
      const { zoom, setZoom } = get();
      setZoom(Math.max(zoom / 1.2, 0.1));
    },

    resetZoom: () => get().setZoom(1),

    toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
    setGridSize: (size) => set({ gridSize: size }),
    toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

    // Tool Actions
    setActiveTool: (tool) => set({ activeTool: tool }),

    // Theme
    toggleTheme: () => set((state) => ({ isDark: !state.isDark })),

    // Selection Actions
    setSelectedObject: (obj) => set({ selectedObject: obj }),
    setSelectedLayerId: (id) => set({ selectedLayerId: id }),
    clearSelection: () => set({ selectedObject: null, selectedLayerId: null }),

    // Layer Actions
    addLayer: (layerData) => {
      const { layers } = get();
      const newLayer: Layer = {
        id: generateId(),
        name: layerData.name || `Layer ${layers.length + 1}`,
        type: layerData.type || 'image',
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'normal',
        order: layers.length,
        x: layerData.x ?? 0,
        y: layerData.y ?? 0,
        width: layerData.width ?? 100,
        height: layerData.height ?? 100,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        flipX: false,
        flipY: false,
        ...layerData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      set((state) => {
        state.layers.push(newLayer);
      });

      get().saveHistory('add_layer');
    },

    updateLayer: (id, updates) => {
      set((state) => {
        const layer = state.layers.find((l) => l.id === id);
        if (layer) {
          Object.assign(layer, { ...updates, updatedAt: new Date() });
        }
      });
    },

    deleteLayer: (id) => {
      set((state) => {
        state.layers = state.layers.filter((l) => l.id !== id);
        state.layers.forEach((l, i) => {
          l.order = i;
        });
      });
      get().saveHistory('delete_layer');
    },

    reorderLayers: (fromIndex, toIndex) => {
      set((state) => {
        const [moved] = state.layers.splice(fromIndex, 1);
        state.layers.splice(toIndex, 0, moved);
        state.layers.forEach((l, i) => {
          l.order = i;
        });
      });
      get().saveHistory('reorder_layers');
    },

    toggleLayerVisibility: (id) => {
      set((state) => {
        const layer = state.layers.find((l) => l.id === id);
        if (layer) {
          layer.visible = !layer.visible;
        }
      });
    },

    toggleLayerLock: (id) => {
      set((state) => {
        const layer = state.layers.find((l) => l.id === id);
        if (layer) {
          layer.locked = !layer.locked;
        }
      });
    },

    setLayerOpacity: (id, opacity) => {
      set((state) => {
        const layer = state.layers.find((l) => l.id === id);
        if (layer) {
          layer.opacity = opacity;
        }
      });
    },

    // History Actions
    saveHistory: (action) => {
      set((state) => {
        if (state.historyIndex < state.history.length - 1) {
          state.history = state.history.slice(0, state.historyIndex + 1);
        }

        const historyEntry = {
          id: generateId(),
          action,
          layers: deepClone(state.layers),
          timestamp: new Date(),
        };

        state.history.push(historyEntry);
        state.historyIndex++;

        if (state.history.length > state.maxHistory) {
          state.history.shift();
          state.historyIndex--;
        }
      });
    },

    undo: () => {
      set((state) => {
        if (state.historyIndex > 0) {
          state.historyIndex--;
          const previousState = state.history[state.historyIndex];
          state.layers = deepClone(previousState.layers);
        }
      });
    },

    redo: () => {
      set((state) => {
        if (state.historyIndex < state.history.length - 1) {
          state.historyIndex++;
          const nextState = state.history[state.historyIndex];
          state.layers = deepClone(nextState.layers);
        }
      });
    },

    canUndo: () => {
      return get().historyIndex > 0;
    },

    canRedo: () => {
      return get().historyIndex < get().history.length - 1;
    },

    clearHistory: () => {
      set({ history: [], historyIndex: -1 });
    },

    // AI Actions
    setActiveRightTab: (tab) => set({ activeRightTab: tab }),
    setAIModel: (model) => set({ aiModel: model }),
    setAIPrompt: (prompt) => set({ aiPrompt: prompt }),
    setAINegativePrompt: (prompt) => set({ aiNegativePrompt: prompt }),
    setIsGenerating: (generating) => set({ isGenerating: generating }),
    addAIJob: (job) => {
      set((state) => {
        state.aiJobs.push(job);
      });
    },
    updateAIJob: (id, updates) => {
      set((state) => {
        const job = state.aiJobs.find((j) => j.id === id);
        if (job) {
          Object.assign(job, { ...updates, updatedAt: new Date() });
        }
      });
    },

    // Export Actions
    setExportFormat: (format) => set({ exportFormat: format }),
    setExportQuality: (quality) => set({ exportQuality: quality }),
  }))
);

// Selector hooks for performance
export const useCanvas = () => useEditorStore((state) => state.canvas);
export const useZoom = () => useEditorStore((state) => state.zoom);
export const useActiveTool = () => useEditorStore((state) => state.activeTool);
export const useLayers = () => useEditorStore((state) => state.layers);
export const useSelectedLayer = () => useEditorStore((state) =>
  state.layers.find((l) => l.id === state.selectedLayerId)
);
