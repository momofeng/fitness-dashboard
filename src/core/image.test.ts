import { expect, it } from 'vitest';
import { fitWithin } from './image';

it.each([
  [4000, 3000, 1080, 1080, 810],
  [3000, 4000, 1080, 810, 1080],
  [800, 600, 1080, 800, 600],
  [1080, 1080, 240, 240, 240],
  [5000, 10, 1080, 1080, 2],
  [0, 100, 1080, 0, 0],
])('%i×%i 長邊 %i → %i×%i', (w, h, max, ew, eh) => {
  expect(fitWithin(w, h, max)).toEqual({ width: ew, height: eh });
});
