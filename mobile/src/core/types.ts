export type Cuisine =
  | 'indian' | 'bangladeshi' | 'tibetan' | 'nepali' | 'mexican' | 'colombian'
  | 'peruvian' | 'chinese' | 'sichuan' | 'taiwanese' | 'korean' | 'japanese'
  | 'malaysian' | 'thai';

export type TimeOfDay = 'afternoon' | 'evening' | 'late-night';

export interface MenuItem {
  name: string;
  emoji: string;
  price: number;
  hunger: number;
  coma: number;
  flavor: number;
  gem?: boolean;
}

export interface Vendor {
  id: string;
  x: number;
  y: number;
  name: string;
  cuisine: Cuisine;
  /** Free-text description shown under the name. */
  blurb: string;
  emoji: string;
  color: string;
  items: MenuItem[];
  /** True if this vendor is hidden until player walks close. */
  hidden?: boolean;
  /** Hours this vendor is open. Times not in this list show the stall as closed. */
  openAt: TimeOfDay[];
}

export interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  hue: number;
}

export interface MapDef {
  id: 'jackson-heights' | 'flushing';
  name: string;
  subtitle: string;
  /** Hex accent color used in UI for this map. */
  accent: string;
  width: number;
  height: number;
  buildings: Building[];
  vendors: Vendor[];
  /** Y coordinate of the elevated subway track. */
  trackY: number;
  /** Vertical-running cross streets. */
  crossStreets: number[];
  /** Y span of the main avenue. */
  avenue: { y: number; h: number };
  /** Color theme strings used in atmospheric rendering. */
  theme: {
    sky: [string, string, string];
    streetTone: string;
  };
}

export interface EatenItem {
  name: string;
  emoji: string;
  price: number;
  flavor: number;
  cuisine: Cuisine;
  gem: boolean;
}

export interface RunResult {
  mapId: MapDef['id'];
  flavor: number;
  spent: number;
  bites: number;
  gems: number;
  comboMax: number;
  cuisinesTried: Cuisine[];
  rank: string;
  endedReason: string;
  date: string;
}
