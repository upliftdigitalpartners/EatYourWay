/** Vendor content, anchored in world-space metres.
 *
 *  Positions were derived from the original hand-authored Jackson Heights and
 *  Flushing layouts and placed as real districts in the open world. Menus,
 *  prices and hidden-gem flags are unchanged from the 2D game.
 */

import type { Vendor } from '../core/types';

export const VENDORS: Vendor[] = [
  {
    id: "jacksondiner", x: 478.8, z: -119.3, district: "Jackson Heights",
    name: "Jackson Diner", cuisine: "indian",
    blurb: "North Indian · 74th St", emoji: "🍛", color: "#ff7a3d",
    openAt: ["afternoon", "evening"],
    items: [
      { name: "Chicken Biryani", emoji: "🍚", price: 14, hunger: 60, coma: 35, flavor: 18 },
      { name: "Garlic Naan", emoji: "🫓", price: 4, hunger: 18, coma: 8, flavor: 6 },
      { name: "Mango Lassi", emoji: "🥭", price: 5, hunger: 8, coma: 5, flavor: 7 },
    ],
  },
  {
    id: "maharaja", x: 603.8, z: -215, district: "Jackson Heights",
    name: "Maharaja Sweets", cuisine: "indian",
    blurb: "Mithai & Chaat · 73rd", emoji: "🍮", color: "#ffd23f",
    openAt: ["afternoon", "evening"],
    items: [
      { name: "Pani Puri (6pc)", emoji: "🥟", price: 6, hunger: 14, coma: 6, flavor: 14 },
      { name: "Gulab Jamun", emoji: "🍡", price: 3, hunger: 6, coma: 12, flavor: 9 },
      { name: "Masala Chai", emoji: "☕", price: 2, hunger: 3, coma: 2, flavor: 5 },
    ],
  },
  {
    id: "paanstall", x: 713.1, z: -310.7, district: "Jackson Heights",
    name: "Paan Singh", cuisine: "indian",
    blurb: "Hidden paan stall", emoji: "🍃", color: "#7cf67c",
    hidden: true,
    openAt: ["evening", "late-night"],
    items: [
      { name: "Sweet Paan", emoji: "🍃", price: 3, hunger: 4, coma: 3, flavor: 22, gem: true },
      { name: "Mukhwas", emoji: "🌰", price: 2, hunger: 2, coma: 1, flavor: 8 },
    ],
  },
  {
    id: "lhasakitchen", x: 916.3, z: -146.7, district: "Jackson Heights",
    name: "Lhasa Fast Food", cuisine: "tibetan",
    blurb: "Tibetan · Diversity Plaza", emoji: "🥟", color: "#2bd4d9",
    openAt: ["afternoon", "evening"],
    items: [
      { name: "Beef Momos (8pc)", emoji: "🥟", price: 8, hunger: 32, coma: 14, flavor: 18 },
      { name: "Thukpa Noodles", emoji: "🍜", price: 9, hunger: 38, coma: 16, flavor: 16 },
      { name: "Butter Tea", emoji: "🍵", price: 3, hunger: 4, coma: 3, flavor: 8 },
    ],
  },
  {
    id: "nepalibhanchha", x: 1010, z: -37.3, district: "Jackson Heights",
    name: "Nepali Bhanchha Ghar", cuisine: "nepali",
    blurb: "Newari Thali", emoji: "🍱", color: "#ff3d8b",
    openAt: ["evening"],
    items: [
      { name: "Choila Set", emoji: "🍖", price: 12, hunger: 42, coma: 22, flavor: 19 },
      { name: "Sel Roti", emoji: "🍩", price: 4, hunger: 14, coma: 9, flavor: 10 },
    ],
  },
  {
    id: "bangladeshi", x: 541.3, z: 44.7, district: "Jackson Heights",
    name: "Sagar Restaurant", cuisine: "bangladeshi",
    blurb: "Bangladeshi · Steam-table", emoji: "🐟", color: "#7cf67c",
    openAt: ["afternoon", "evening"],
    items: [
      { name: "Fish Bhuna + Rice", emoji: "🐟", price: 11, hunger: 38, coma: 18, flavor: 17 },
      { name: "Beef Tehari", emoji: "🍛", price: 10, hunger: 36, coma: 20, flavor: 15 },
      { name: "Chai", emoji: "☕", price: 2, hunger: 3, coma: 2, flavor: 5 },
    ],
  },
  {
    id: "tamalecart", x: 1197.5, z: 72, district: "Jackson Heights",
    name: "Doña Maria", cuisine: "mexican",
    blurb: "Tamale Cart · Street", emoji: "🫔", color: "#ff7a3d",
    openAt: ["afternoon", "evening", "late-night"],
    items: [
      { name: "Tamale Verde", emoji: "🫔", price: 3, hunger: 22, coma: 10, flavor: 14 },
      { name: "Atole Champurrado", emoji: "🍫", price: 3, hunger: 8, coma: 5, flavor: 9 },
      { name: "Tamale Dulce", emoji: "🍠", price: 3, hunger: 18, coma: 12, flavor: 11 },
    ],
  },
  {
    id: "birriacart", x: 1322.5, z: 17.3, district: "Jackson Heights",
    name: "Birria Bros", cuisine: "mexican",
    blurb: "Tent · Roosevelt Ave", emoji: "🌮", color: "#ff3d8b",
    openAt: ["evening", "late-night"],
    items: [
      { name: "Quesabirria (3pc)", emoji: "🌮", price: 12, hunger: 40, coma: 24, flavor: 22 },
      { name: "Consomé Cup", emoji: "🍲", price: 4, hunger: 12, coma: 6, flavor: 11 },
    ],
  },
  {
    id: "arepalady", x: 1510, z: -105.7, district: "Jackson Heights",
    name: "Arepa Lady", cuisine: "colombian",
    blurb: "Colombian · 79th St", emoji: "🌽", color: "#ffd23f",
    openAt: ["evening", "late-night"],
    items: [
      { name: "Arepa de Choclo", emoji: "🌽", price: 7, hunger: 28, coma: 14, flavor: 19 },
      { name: "Arepa Queso", emoji: "🧀", price: 6, hunger: 22, coma: 12, flavor: 14 },
      { name: "Chicha Morada", emoji: "🍷", price: 4, hunger: 6, coma: 3, flavor: 9 },
    ],
  },
  {
    id: "pollosmario", x: 1619.4, z: 17.3, district: "Jackson Heights",
    name: "Pollos Mario", cuisine: "peruvian",
    blurb: "Peruvian · Rotisserie", emoji: "🍗", color: "#ff7a3d",
    openAt: ["afternoon", "evening"],
    items: [
      { name: "1/4 Pollo a la Brasa", emoji: "🍗", price: 11, hunger: 44, coma: 22, flavor: 17 },
      { name: "Yuca Frita", emoji: "🍟", price: 5, hunger: 16, coma: 10, flavor: 9 },
      { name: "Inca Kola", emoji: "🥤", price: 3, hunger: 4, coma: 4, flavor: 6 },
    ],
  },
  {
    id: "basementmomo", x: 1088.1, z: 208.7, district: "Jackson Heights",
    name: "Basement Jhol", cuisine: "nepali",
    blurb: "Hidden basement momo joint", emoji: "✨", color: "#7cf67c",
    hidden: true,
    openAt: ["late-night"],
    items: [
      { name: "Jhol Momo", emoji: "🥟", price: 9, hunger: 30, coma: 14, flavor: 26, gem: true },
      { name: "Sukuti", emoji: "🥩", price: 7, hunger: 18, coma: 12, flavor: 18, gem: true },
    ],
  },
  {
    id: "newworldmall", x: 4476.7, z: -145, district: "Flushing",
    name: "New World Mall", cuisine: "chinese",
    blurb: "Food court · Roosevelt", emoji: "🥡", color: "#ff3d8b",
    openAt: ["afternoon", "evening"],
    items: [
      { name: "Cantonese Roast Duck", emoji: "🦆", price: 14, hunger: 44, coma: 24, flavor: 20 },
      { name: "Wonton Noodle Soup", emoji: "🍜", price: 9, hunger: 32, coma: 14, flavor: 15 },
      { name: "Egg Tart", emoji: "🥧", price: 2, hunger: 6, coma: 8, flavor: 8 },
    ],
  },
  {
    id: "sichuan", x: 4693.3, z: -310, district: "Flushing",
    name: "Chengdu Tianfu", cuisine: "sichuan",
    blurb: "Sichuan · 39th Ave", emoji: "🌶️", color: "#ff3d8b",
    openAt: ["afternoon", "evening"],
    items: [
      { name: "Mapo Tofu", emoji: "🌶️", price: 12, hunger: 36, coma: 20, flavor: 22 },
      { name: "Dan Dan Noodles", emoji: "🍜", price: 10, hunger: 32, coma: 16, flavor: 18 },
      { name: "Wontons in Chili Oil", emoji: "🥟", price: 8, hunger: 22, coma: 10, flavor: 16 },
    ],
  },
  {
    id: "xianfamous", x: 4943.3, z: -190, district: "Flushing",
    name: "Xi'an Famous Foods", cuisine: "chinese",
    blurb: "Hand-pulled · Golden Mall", emoji: "🍜", color: "#ffd23f",
    openAt: ["afternoon", "evening"],
    items: [
      { name: "Spicy Cumin Lamb Noodle", emoji: "🍜", price: 12, hunger: 40, coma: 18, flavor: 23 },
      { name: "Liang Pi (Cold Skin)", emoji: "🥬", price: 9, hunger: 22, coma: 8, flavor: 17 },
      { name: "Pork \"Burger\" Roujiamo", emoji: "🥪", price: 6, hunger: 24, coma: 12, flavor: 14 },
    ],
  },
  {
    id: "goldenmall", x: 5060, z: -325, district: "Flushing",
    name: "Lan Zhou Hand-Pulled", cuisine: "chinese",
    blurb: "Basement noodle counter", emoji: "🥢", color: "#7cf67c",
    hidden: true,
    openAt: ["evening", "late-night"],
    items: [
      { name: "Beef Hand-Pulled Noodle", emoji: "🍜", price: 9, hunger: 38, coma: 16, flavor: 26, gem: true },
      { name: "Lamb Skewers (5pc)", emoji: "🍢", price: 6, hunger: 18, coma: 10, flavor: 19, gem: true },
    ],
  },
  {
    id: "tinywonton", x: 5260, z: -160, district: "Flushing",
    name: "White Bear", cuisine: "sichuan",
    blurb: "Wontons in chili · Tiny shop", emoji: "🥟", color: "#ff7a3d",
    openAt: ["afternoon", "evening"],
    items: [
      { name: "#6 Wontons in Chili Oil", emoji: "🥟", price: 7, hunger: 20, coma: 8, flavor: 24, gem: true },
      { name: "Pickled Cabbage", emoji: "🥬", price: 3, hunger: 6, coma: 2, flavor: 9 },
    ],
  },
  {
    id: "taipeihotpot", x: 5526.7, z: -145, district: "Flushing",
    name: "Taipei Hong", cuisine: "taiwanese",
    blurb: "Beef Noodle · Prince St", emoji: "🐮", color: "#ff3d8b",
    openAt: ["evening"],
    items: [
      { name: "Beef Noodle Soup", emoji: "🍜", price: 13, hunger: 42, coma: 22, flavor: 21 },
      { name: "Popcorn Chicken", emoji: "🍗", price: 7, hunger: 18, coma: 14, flavor: 14 },
      { name: "Scallion Pancake", emoji: "🥞", price: 5, hunger: 18, coma: 8, flavor: 12 },
    ],
  },
  {
    id: "kbbq", x: 4593.3, z: 35, district: "Flushing",
    name: "Kang Suh Express", cuisine: "korean",
    blurb: "Korean · Northern Blvd", emoji: "🥩", color: "#ff7a3d",
    openAt: ["evening", "late-night"],
    items: [
      { name: "Bulgogi Bento", emoji: "🥩", price: 12, hunger: 40, coma: 22, flavor: 19 },
      { name: "Soft Tofu Stew", emoji: "🍲", price: 11, hunger: 36, coma: 16, flavor: 17 },
      { name: "Kimchi Pancake", emoji: "🥞", price: 8, hunger: 22, coma: 12, flavor: 13 },
    ],
  },
  {
    id: "tonkatsu", x: 4893.3, z: 50, district: "Flushing",
    name: "Katsu-ya", cuisine: "japanese",
    blurb: "Tonkatsu · Main St", emoji: "🍱", color: "#ffd23f",
    openAt: ["afternoon", "evening"],
    items: [
      { name: "Tonkatsu Set", emoji: "🍱", price: 14, hunger: 46, coma: 26, flavor: 19 },
      { name: "Onigiri (2pc)", emoji: "🍙", price: 5, hunger: 14, coma: 6, flavor: 9 },
      { name: "Matcha Latte", emoji: "🍵", price: 4, hunger: 4, coma: 3, flavor: 7 },
    ],
  },
  {
    id: "bobashop", x: 5260, z: 80, district: "Flushing",
    name: "Tea & Milk", cuisine: "taiwanese",
    blurb: "Boba · Off Roosevelt", emoji: "🧋", color: "#2bd4d9",
    openAt: ["afternoon", "evening", "late-night"],
    items: [
      { name: "Brown Sugar Boba", emoji: "🧋", price: 6, hunger: 8, coma: 12, flavor: 14 },
      { name: "Taro Milk Tea", emoji: "🥤", price: 5, hunger: 6, coma: 8, flavor: 11 },
      { name: "Mango Snow Ice", emoji: "🍧", price: 7, hunger: 12, coma: 10, flavor: 13 },
    ],
  },
  {
    id: "malaysian", x: 5543.3, z: 50, district: "Flushing",
    name: "Curry Leaves", cuisine: "malaysian",
    blurb: "Malaysian · Prince", emoji: "🍛", color: "#ff7a3d",
    openAt: ["evening"],
    items: [
      { name: "Roti Canai", emoji: "🫓", price: 6, hunger: 18, coma: 8, flavor: 16 },
      { name: "Hainanese Chicken", emoji: "🍗", price: 12, hunger: 38, coma: 20, flavor: 18 },
      { name: "Laksa", emoji: "🍜", price: 11, hunger: 34, coma: 18, flavor: 21 },
    ],
  },
  {
    id: "hiddendim", x: 4860, z: 260, district: "Flushing",
    name: "Tim Ho Express", cuisine: "chinese",
    blurb: "Dim sum cart · Hidden alley", emoji: "🥟", color: "#7cf67c",
    hidden: true,
    openAt: ["afternoon"],
    items: [
      { name: "Char Siu Bao", emoji: "🥟", price: 5, hunger: 16, coma: 8, flavor: 22, gem: true },
      { name: "Shumai (4pc)", emoji: "🥟", price: 6, hunger: 18, coma: 10, flavor: 19, gem: true },
      { name: "Egg Custard Bun", emoji: "🥮", price: 4, hunger: 12, coma: 12, flavor: 16, gem: true },
    ],
  },
  {
    id: "thaitemple", x: 5460, z: 245, district: "Flushing",
    name: "Wat Buddharangsi Stall", cuisine: "thai",
    blurb: "Sunday-only Thai temple food", emoji: "🍛", color: "#ff3d8b",
    openAt: ["afternoon"],
    items: [
      { name: "Khao Soi", emoji: "🍜", price: 10, hunger: 36, coma: 18, flavor: 22 },
      { name: "Mango Sticky Rice", emoji: "🥭", price: 7, hunger: 18, coma: 14, flavor: 17 },
    ],
  },
  {
    id: "lemonice", x: 2604, z: -84, district: "Corona",
    name: "Lemon Ice King of Corona", cuisine: "italian",
    blurb: "Italian ices since 1944 · 108th St", emoji: "🍧", color: "#ffe66d",
    openAt: ["afternoon", "evening", "late-night"],
    items: [
      { name: "Lemon Ice", emoji: "🍋", price: 4, hunger: 8, coma: 4, flavor: 12 },
      { name: "Rainbow Ice", emoji: "🌈", price: 5, hunger: 10, coma: 6, flavor: 11 },
      { name: "Peanut Butter Ice", emoji: "🥜", price: 5, hunger: 14, coma: 9, flavor: 17, gem: true },
    ],
  },
  {
    id: "nixtamal", x: 2382, z: 118, district: "Corona",
    name: "Tortilleria Nixtamal", cuisine: "mexican",
    blurb: "Masa ground on site · 104th St", emoji: "🌮", color: "#ff7a3d",
    openAt: ["afternoon", "evening"],
    items: [
      { name: "Tacos al Pastor (3pc)", emoji: "🌮", price: 9, hunger: 42, coma: 22, flavor: 19 },
      { name: "Masa Quesadilla", emoji: "🫓", price: 7, hunger: 30, coma: 16, flavor: 14 },
      { name: "Horchata", emoji: "🥛", price: 4, hunger: 8, coma: 6, flavor: 7 },
    ],
  },
  {
    id: "leos", x: 2856, z: -262, district: "Corona",
    name: "Leo's Latticini", cuisine: "italian",
    blurb: "Mama's · fresh mozz, cash only", emoji: "🧀", color: "#f4a261",
    hidden: true,
    openAt: ["afternoon"],
    items: [
      { name: "Hero Sandwich", emoji: "🥖", price: 13, hunger: 58, coma: 30, flavor: 24, gem: true },
      { name: "Fresh Mozzarella", emoji: "🧀", price: 6, hunger: 20, coma: 10, flavor: 13 },
      { name: "Rice Ball", emoji: "🍙", price: 4, hunger: 24, coma: 15, flavor: 11 },
    ],
  },
  {
    id: "coronaplaza", x: 2498, z: -196, district: "Corona",
    name: "Corona Plaza Elotes", cuisine: "mexican",
    blurb: "Street cart cluster under the 7", emoji: "🌽", color: "#ffd23f",
    openAt: ["evening", "late-night"],
    items: [
      { name: "Elote", emoji: "🌽", price: 4, hunger: 18, coma: 8, flavor: 12 },
      { name: "Esquites", emoji: "🥣", price: 5, hunger: 22, coma: 10, flavor: 14 },
      { name: "Mangonada", emoji: "🥭", price: 6, hunger: 12, coma: 9, flavor: 16, gem: true },
    ],
  },
];

export const DISTRICTS = [...new Set(VENDORS.map(v => v.district))];
