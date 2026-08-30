/** Game-domain types. Kept free of rendering and physics concerns so the
 *  rules stay portable between the web client, the importer and mobile. */

export type Cuisine =
  | 'indian' | 'bangladeshi' | 'tibetan' | 'nepali' | 'mexican' | 'colombian'
  | 'peruvian' | 'chinese' | 'sichuan' | 'taiwanese' | 'korean' | 'japanese'
  | 'malaysian' | 'thai' | 'greek' | 'italian' | 'caribbean' | 'polish';

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

/** A vendor anchored in the open world. x/z are metres in the world frame. */
export interface Vendor {
  id: string;
  x: number;
  z: number;
  name: string;
  cuisine: Cuisine;
  blurb: string;
  emoji: string;
  color: string;
  items: MenuItem[];
  /** Hidden vendors do not appear on the map until discovered up close. */
  hidden?: boolean;
  openAt: TimeOfDay[];
  /** Neighbourhood label, used for grouping and the end-of-run summary. */
  district: string;
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
  worldName: string;
  flavor: number;
  spent: number;
  bites: number;
  gems: number;
  comboMax: number;
  cuisinesTried: Cuisine[];
  districtsVisited: string[];
  /** Metres travelled, split by how you got there. */
  distanceByMode: Record<string, number>;
  rank: string;
  endedReason: string;
  date: string;
}
