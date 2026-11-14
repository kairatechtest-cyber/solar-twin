/** Development settings (ng serve). Production replaces this file with environment.prod.ts. */
export const environment = {
  production: false,
  /** Straight to the backend in dev (avoids dev-server WebSocket proxy noise). Empty = same host + /ws. */
  wsUrl: 'ws://localhost:4000/ws',
  modelUrl: '/models/solar_plant.glb',
  /** Optional low-poly proxy shown instantly while the full model streams in. '' to disable. */
  lodUrl: '/models/solar_plant.lod.glb',
};
