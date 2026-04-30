import type { MapDef } from '../types';

export const jacksonHeights: MapDef = {
  id: 'jackson-heights',
  name: 'Jackson Heights',
  subtitle: 'Roosevelt Ave · 74th to 82nd',
  accent: '#ff3d8b',
  width: 960,
  height: 600,
  trackY: 410,
  crossStreets: [340, 560, 740],
  avenue: { y: 350, h: 80 },
  theme: {
    sky: ['#2d1b4e', '#1a0b2e', '#0a0518'],
    streetTone: '#1a1028',
  },
  buildings: [
    { x: 80,  y: 80,  w: 240, h: 100, hue: 285 },
    { x: 80,  y: 250, w: 100, h: 80,  hue: 320 },
    { x: 200, y: 250, w: 140, h: 90,  hue: 305 },
    { x: 380, y: 100, w: 160, h: 80,  hue: 200 },
    { x: 380, y: 250, w: 180, h: 110, hue: 215 },
    { x: 600, y: 100, w: 220, h: 100, hue: 340 },
    { x: 580, y: 250, w: 130, h: 90,  hue: 355 },
    { x: 730, y: 250, w: 110, h: 90,  hue: 30 },
    { x: 760, y: 80,  w: 180, h: 80,  hue: 50 },
    { x: 860, y: 280, w: 80,  h: 80,  hue: 60 },
    { x: 80,  y: 440, w: 180, h: 100, hue: 270 },
    { x: 290, y: 440, w: 200, h: 100, hue: 290 },
    { x: 510, y: 480, w: 100, h: 70,  hue: 310 },
    { x: 640, y: 440, w: 200, h: 100, hue: 250 },
    { x: 860, y: 440, w: 80,  h: 100, hue: 220 },
  ],
  vendors: [
    {
      id: 'jacksondiner', x: 140, y: 220, name: 'Jackson Diner',
      cuisine: 'indian', blurb: 'North Indian · 74th St', emoji: '🍛',
      color: '#ff7a3d', openAt: ['afternoon', 'evening'],
      items: [
        { name: 'Chicken Biryani',  emoji: '🍚', price: 14, hunger: 60, coma: 35, flavor: 18 },
        { name: 'Garlic Naan',       emoji: '🫓', price: 4,  hunger: 18, coma: 8,  flavor: 6 },
        { name: 'Mango Lassi',       emoji: '🥭', price: 5,  hunger: 8,  coma: 5,  flavor: 7 },
      ],
    },
    {
      id: 'maharaja', x: 220, y: 150, name: 'Maharaja Sweets',
      cuisine: 'indian', blurb: 'Mithai & Chaat · 73rd', emoji: '🍮',
      color: '#ffd23f', openAt: ['afternoon', 'evening'],
      items: [
        { name: 'Pani Puri (6pc)',   emoji: '🥟', price: 6,  hunger: 14, coma: 6,  flavor: 14 },
        { name: 'Gulab Jamun',       emoji: '🍡', price: 3,  hunger: 6,  coma: 12, flavor: 9 },
        { name: 'Masala Chai',       emoji: '☕', price: 2,  hunger: 3,  coma: 2,  flavor: 5 },
      ],
    },
    {
      id: 'paanstall', x: 290, y: 80, name: 'Paan Singh',
      cuisine: 'indian', blurb: 'Hidden paan stall', emoji: '🍃',
      color: '#7cf67c', hidden: true, openAt: ['evening', 'late-night'],
      items: [
        { name: 'Sweet Paan',         emoji: '🍃', price: 3,  hunger: 4,  coma: 3,  flavor: 22, gem: true },
        { name: 'Mukhwas',            emoji: '🌰', price: 2,  hunger: 2,  coma: 1,  flavor: 8 },
      ],
    },
    {
      id: 'lhasakitchen', x: 420, y: 200, name: 'Lhasa Fast Food',
      cuisine: 'tibetan', blurb: 'Tibetan · Diversity Plaza', emoji: '🥟',
      color: '#2bd4d9', openAt: ['afternoon', 'evening'],
      items: [
        { name: 'Beef Momos (8pc)',  emoji: '🥟', price: 8,  hunger: 32, coma: 14, flavor: 18 },
        { name: 'Thukpa Noodles',    emoji: '🍜', price: 9,  hunger: 38, coma: 16, flavor: 16 },
        { name: 'Butter Tea',        emoji: '🍵', price: 3,  hunger: 4,  coma: 3,  flavor: 8 },
      ],
    },
    {
      id: 'nepalibhanchha', x: 480, y: 280, name: 'Nepali Bhanchha Ghar',
      cuisine: 'nepali', blurb: 'Newari Thali', emoji: '🍱',
      color: '#ff3d8b', openAt: ['evening'],
      items: [
        { name: 'Choila Set',        emoji: '🍖', price: 12, hunger: 42, coma: 22, flavor: 19 },
        { name: 'Sel Roti',          emoji: '🍩', price: 4,  hunger: 14, coma: 9,  flavor: 10 },
      ],
    },
    {
      id: 'bangladeshi', x: 180, y: 340, name: 'Sagar Restaurant',
      cuisine: 'bangladeshi', blurb: 'Bangladeshi · Steam-table', emoji: '🐟',
      color: '#7cf67c', openAt: ['afternoon', 'evening'],
      items: [
        { name: 'Fish Bhuna + Rice',  emoji: '🐟', price: 11, hunger: 38, coma: 18, flavor: 17 },
        { name: 'Beef Tehari',        emoji: '🍛', price: 10, hunger: 36, coma: 20, flavor: 15 },
        { name: 'Chai',               emoji: '☕', price: 2,  hunger: 3,  coma: 2,  flavor: 5 },
      ],
    },
    {
      id: 'tamalecart', x: 600, y: 360, name: 'Doña Maria',
      cuisine: 'mexican', blurb: 'Tamale Cart · Street', emoji: '🫔',
      color: '#ff7a3d', openAt: ['afternoon', 'evening', 'late-night'],
      items: [
        { name: 'Tamale Verde',          emoji: '🫔', price: 3,  hunger: 22, coma: 10, flavor: 14 },
        { name: 'Atole Champurrado',     emoji: '🍫', price: 3,  hunger: 8,  coma: 5,  flavor: 9 },
        { name: 'Tamale Dulce',          emoji: '🍠', price: 3,  hunger: 18, coma: 12, flavor: 11 },
      ],
    },
    {
      id: 'birriacart', x: 680, y: 320, name: 'Birria Bros',
      cuisine: 'mexican', blurb: 'Tent · Roosevelt Ave', emoji: '🌮',
      color: '#ff3d8b', openAt: ['evening', 'late-night'],
      items: [
        { name: 'Quesabirria (3pc)',  emoji: '🌮', price: 12, hunger: 40, coma: 24, flavor: 22 },
        { name: 'Consomé Cup',        emoji: '🍲', price: 4,  hunger: 12, coma: 6,  flavor: 11 },
      ],
    },
    {
      id: 'arepalady', x: 800, y: 230, name: 'Arepa Lady',
      cuisine: 'colombian', blurb: 'Colombian · 79th St', emoji: '🌽',
      color: '#ffd23f', openAt: ['evening', 'late-night'],
      items: [
        { name: 'Arepa de Choclo',    emoji: '🌽', price: 7,  hunger: 28, coma: 14, flavor: 19 },
        { name: 'Arepa Queso',        emoji: '🧀', price: 6,  hunger: 22, coma: 12, flavor: 14 },
        { name: 'Chicha Morada',      emoji: '🍷', price: 4,  hunger: 6,  coma: 3,  flavor: 9 },
      ],
    },
    {
      id: 'pollosmario', x: 870, y: 320, name: 'Pollos Mario',
      cuisine: 'peruvian', blurb: 'Peruvian · Rotisserie', emoji: '🍗',
      color: '#ff7a3d', openAt: ['afternoon', 'evening'],
      items: [
        { name: '1/4 Pollo a la Brasa', emoji: '🍗', price: 11, hunger: 44, coma: 22, flavor: 17 },
        { name: 'Yuca Frita',           emoji: '🍟', price: 5,  hunger: 16, coma: 10, flavor: 9 },
        { name: 'Inca Kola',            emoji: '🥤', price: 3,  hunger: 4,  coma: 4,  flavor: 6 },
      ],
    },
    {
      id: 'basementmomo', x: 530, y: 460, name: 'Basement Jhol',
      cuisine: 'nepali', blurb: 'Hidden basement momo joint', emoji: '✨',
      color: '#7cf67c', hidden: true, openAt: ['late-night'],
      items: [
        { name: 'Jhol Momo',         emoji: '🥟', price: 9,  hunger: 30, coma: 14, flavor: 26, gem: true },
        { name: 'Sukuti',            emoji: '🥩', price: 7,  hunger: 18, coma: 12, flavor: 18, gem: true },
      ],
    },
  ],
};
