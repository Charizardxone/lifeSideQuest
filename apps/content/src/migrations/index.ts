import * as migration_20260915_081200_initial_payload from './20260915_081200_initial_payload';
import * as migration_20260915_125830_main_features from './20260915_125830_main_features';

export const migrations = [
  {
    up: migration_20260915_081200_initial_payload.up,
    down: migration_20260915_081200_initial_payload.down,
    name: '20260915_081200_initial_payload',
  },
  {
    up: migration_20260915_125830_main_features.up,
    down: migration_20260915_125830_main_features.down,
    name: '20260915_125830_main_features',
  },
];
