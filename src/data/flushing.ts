import type { MapDef } from '../types';

export const flushing: MapDef = {
  id: 'flushing',
  name: 'Flushing',
  subtitle: 'Main St · Roosevelt · Prince',
  accent: '#2bd4d9',
  width: 960,
  height: 600,
  trackY: 380,
  crossStreets: [300, 520, 720],
  avenue: { y: 320, h: 80 },
  theme: {
    sky: ['#0d2b4a', '#0a1f38', '#03101f'],
    streetTone: '#0a1a2c',
  },
  buildings: [
    { x: 60,  y: 60,  w: 200, h: 110, hue: 195 },
    { x: 280, y: 60,  w: 220, h: 110, hue: 0   },
    { x: 520, y: 60,  w: 160, h: 90,  hue: 50  },
    { x: 700, y: 60,  w: 200, h: 110, hue: 165 },
    { x: 60,  y: 200, w: 230, h: 100, hue: 180 },
    { x: 320, y: 200, w: 190, h: 100, hue: 25  },
    { x: 540, y: 200, w: 180, h: 100, hue: 280 },
    { x: 750, y: 200, w: 180, h: 100, hue: 130 },
    { x: 60,  y: 420, w: 160, h: 110, hue: 200 },
    { x: 240, y: 420, w: 180, h: 110, hue: 220 },
    { x: 440, y: 440, w: 100, h: 90,  hue: 320 },
    { x: 560, y: 420, w: 200, h: 110, hue: 240 },
    { x: 780, y: 420, w: 150, h: 110, hue: 190 },
  ],
  vendors: [
    {
      id: 'newworldmall', x: 130, y: 250, name: 'New World Mall',
      cuisine: 'chinese', blurb: 'Food court · Roosevelt', emoji: '🥡',
      color: '#ff3d8b', openAt: ['afternoon', 'evening'],
      items: [
        { name: 'Cantonese Roast Duck', emoji: '🦆', price: 14, hunger: 44, coma: 24, flavor: 20 },
        { name: 'Wonton Noodle Soup',   emoji: '🍜', price: 9,  hunger: 32, coma: 14, flavor: 15 },
        { name: 'Egg Tart',             emoji: '🥧', price: 2,  hunger: 6,  coma: 8,  flavor: 8 },
      ],
    },
    {
      id: 'sichuan', x: 260, y: 140, name: 'Chengdu Tianfu',
      cuisine: 'sichuan', blurb: 'Sichuan · 39th Ave', emoji: '🌶️',
      color: '#ff3d8b', openAt: ['afternoon', 'evening'],
      items: [
        { name: 'Mapo Tofu',           emoji: '🌶️', price: 12, hunger: 36, coma: 20, flavor: 22 },
        { name: 'Dan Dan Noodles',     emoji: '🍜', price: 10, hunger: 32, coma: 16, flavor: 18 },
        { name: 'Wontons in Chili Oil', emoji: '🥟', price: 8, hunger: 22, coma: 10, flavor: 16 },
      ],
    },
    {
      id: 'xianfamous', x: 410, y: 220, name: "Xi'an Famous Foods",
      cuisine: 'chinese', blurb: 'Hand-pulled · Golden Mall', emoji: '🍜',
      color: '#ffd23f', openAt: ['afternoon', 'evening'],
      items: [
        { name: 'Spicy Cumin Lamb Noodle', emoji: '🍜', price: 12, hunger: 40, coma: 18, flavor: 23 },
        { name: 'Liang Pi (Cold Skin)',    emoji: '🥬', price: 9,  hunger: 22, coma: 8,  flavor: 17 },
        { name: 'Pork "Burger" Roujiamo',  emoji: '🥪', price: 6,  hunger: 24, coma: 12, flavor: 14 },
      ],
    },
    {
      id: 'goldenmall', x: 480, y: 130, name: 'Lan Zhou Hand-Pulled',
      cuisine: 'chinese', blurb: 'Basement noodle counter', emoji: '🥢',
      color: '#7cf67c', hidden: true, openAt: ['evening', 'late-night'],
      items: [
        { name: 'Beef Hand-Pulled Noodle', emoji: '🍜', price: 9, hunger: 38, coma: 16, flavor: 26, gem: true },
        { name: 'Lamb Skewers (5pc)',      emoji: '🍢', price: 6, hunger: 18, coma: 10, flavor: 19, gem: true },
      ],
    },
    {
      id: 'tinywonton', x: 600, y: 240, name: 'White Bear',
      cuisine: 'sichuan', blurb: 'Wontons in chili · Tiny shop', emoji: '🥟',
      color: '#ff7a3d', openAt: ['afternoon', 'evening'],
      items: [
        { name: '#6 Wontons in Chili Oil', emoji: '🥟', price: 7,  hunger: 20, coma: 8,  flavor: 24, gem: true },
        { name: 'Pickled Cabbage',         emoji: '🥬', price: 3,  hunger: 6,  coma: 2,  flavor: 9 },
      ],
    },
    {
      id: 'taipeihotpot', x: 760, y: 250, name: 'Taipei Hong',
      cuisine: 'taiwanese', blurb: 'Beef Noodle · Prince St', emoji: '🐮',
      color: '#ff3d8b', openAt: ['evening'],
      items: [
        { name: 'Beef Noodle Soup',  emoji: '🍜', price: 13, hunger: 42, coma: 22, flavor: 21 },
        { name: 'Popcorn Chicken',   emoji: '🍗', price: 7,  hunger: 18, coma: 14, flavor: 14 },
        { name: 'Scallion Pancake',  emoji: '🥞', price: 5,  hunger: 18, coma: 8,  flavor: 12 },
      ],
    },
    {
      id: 'kbbq', x: 200, y: 370, name: 'Kang Suh Express',
      cuisine: 'korean', blurb: 'Korean · Northern Blvd', emoji: '🥩',
      color: '#ff7a3d', openAt: ['evening', 'late-night'],
      items: [
        { name: 'Bulgogi Bento',     emoji: '🥩', price: 12, hunger: 40, coma: 22, flavor: 19 },
        { name: 'Soft Tofu Stew',    emoji: '🍲', price: 11, hunger: 36, coma: 16, flavor: 17 },
        { name: 'Kimchi Pancake',    emoji: '🥞', price: 8,  hunger: 22, coma: 12, flavor: 13 },
      ],
    },
    {
      id: 'tonkatsu', x: 380, y: 380, name: 'Katsu-ya',
      cuisine: 'japanese', blurb: 'Tonkatsu · Main St', emoji: '🍱',
      color: '#ffd23f', openAt: ['afternoon', 'evening'],
      items: [
        { name: 'Tonkatsu Set',       emoji: '🍱', price: 14, hunger: 46, coma: 26, flavor: 19 },
        { name: 'Onigiri (2pc)',      emoji: '🍙', price: 5,  hunger: 14, coma: 6,  flavor: 9 },
        { name: 'Matcha Latte',       emoji: '🍵', price: 4,  hunger: 4,  coma: 3,  flavor: 7 },
      ],
    },
    {
      id: 'bobashop', x: 600, y: 400, name: 'Tea & Milk',
      cuisine: 'taiwanese', blurb: 'Boba · Off Roosevelt', emoji: '🧋',
      color: '#2bd4d9', openAt: ['afternoon', 'evening', 'late-night'],
      items: [
        { name: 'Brown Sugar Boba',   emoji: '🧋', price: 6,  hunger: 8,  coma: 12, flavor: 14 },
        { name: 'Taro Milk Tea',      emoji: '🥤', price: 5,  hunger: 6,  coma: 8,  flavor: 11 },
        { name: 'Mango Snow Ice',     emoji: '🍧', price: 7,  hunger: 12, coma: 10, flavor: 13 },
      ],
    },
    {
      id: 'malaysian', x: 770, y: 380, name: 'Curry Leaves',
      cuisine: 'malaysian', blurb: 'Malaysian · Prince', emoji: '🍛',
      color: '#ff7a3d', openAt: ['evening'],
      items: [
        { name: 'Roti Canai',         emoji: '🫓', price: 6,  hunger: 18, coma: 8,  flavor: 16 },
        { name: 'Hainanese Chicken',  emoji: '🍗', price: 12, hunger: 38, coma: 20, flavor: 18 },
        { name: 'Laksa',              emoji: '🍜', price: 11, hunger: 34, coma: 18, flavor: 21 },
      ],
    },
    {
      id: 'hiddendim', x: 360, y: 520, name: 'Tim Ho Express',
      cuisine: 'chinese', blurb: 'Dim sum cart · Hidden alley', emoji: '🥟',
      color: '#7cf67c', hidden: true, openAt: ['afternoon'],
      items: [
        { name: 'Char Siu Bao',       emoji: '🥟', price: 5,  hunger: 16, coma: 8,  flavor: 22, gem: true },
        { name: 'Shumai (4pc)',       emoji: '🥟', price: 6,  hunger: 18, coma: 10, flavor: 19, gem: true },
        { name: 'Egg Custard Bun',    emoji: '🥮', price: 4,  hunger: 12, coma: 12, flavor: 16, gem: true },
      ],
    },
    {
      id: 'thaitemple', x: 720, y: 510, name: 'Wat Buddharangsi Stall',
      cuisine: 'thai', blurb: 'Sunday-only Thai temple food', emoji: '🍛',
      color: '#ff3d8b', openAt: ['afternoon'],
      items: [
        { name: 'Khao Soi',           emoji: '🍜', price: 10, hunger: 36, coma: 18, flavor: 22 },
        { name: 'Mango Sticky Rice',  emoji: '🥭', price: 7,  hunger: 18, coma: 14, flavor: 17 },
      ],
    },
  ],
};
