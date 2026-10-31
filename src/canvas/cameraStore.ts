import { create } from 'zustand';
import {
  DEFAULT_CAMERA,
  fitMapToViewport,
  panCamera,
  zoomBy,
  type Camera,
  type ScreenPoint,
  type ViewportSize,
} from './camera';

interface CameraState {
  camera: Camera;
  viewport: ViewportSize;
  fitted: boolean;
  setViewport: (viewport: ViewportSize) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAtPoint: (anchor: ScreenPoint, factor: number) => void;
  zoomByStep: (factor: number) => void;
  fit: (mapWidth: number, mapHeight: number) => void;
  reset: () => void;
}

export const useCameraStore = create<CameraState>()((set, get) => ({
  camera: DEFAULT_CAMERA,
  viewport: { width: 0, height: 0 },
  fitted: false,

  setViewport: (viewport) => set({ viewport }),

  panBy: (dx, dy) => set((state) => ({ camera: panCamera(state.camera, dx, dy) })),

  zoomAtPoint: (anchor, factor) =>
    set((state) => ({ camera: zoomBy(state.camera, anchor, factor) })),

  zoomByStep: (factor) => {
    const { viewport } = get();
    if (viewport.width <= 0 || viewport.height <= 0) return;
    get().zoomAtPoint({ x: viewport.width / 2, y: viewport.height / 2 }, factor);
  },

  fit: (mapWidth, mapHeight) => {
    const { viewport } = get();
    if (viewport.width <= 0 || viewport.height <= 0) return;
    set({
      camera: fitMapToViewport(mapWidth, mapHeight, viewport),
      fitted: true,
    });
  },

  reset: () => set({ camera: DEFAULT_CAMERA, fitted: false }),
}));
