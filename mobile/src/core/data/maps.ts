import type { MapDef } from '../types';
import { jacksonHeights } from './jacksonHeights';
import { flushing } from './flushing';

export const MAPS: Record<MapDef['id'], MapDef> = {
  'jackson-heights': jacksonHeights,
  'flushing': flushing,
};

export const MAP_LIST: MapDef[] = [jacksonHeights, flushing];
