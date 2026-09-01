/**
 * Desktop Pet Registry
 *
 * Uses the Kenney "Cube Pets" preview sprites (64x64 PNG, ~2KB each).
 * These tiny sprites keep the pet extremely lightweight: no 3D rendering,
 * no GPU load, ~100KB total for all 24 pets. Rendered with CSS transforms
 * and `image-rendering: pixelated` to preserve the cube/voxel aesthetic.
 */

export type PetId =
  | "beaver" | "bee" | "bunny" | "cat" | "caterpillar" | "chick"
  | "cow" | "crab" | "deer" | "dog" | "elephant" | "fish"
  | "fox" | "giraffe" | "hog" | "koala" | "lion" | "monkey"
  | "panda" | "parrot" | "penguin" | "pig" | "polar" | "tiger";

export interface PetMeta {
  id: PetId;
  name: string;       // English name
  nameCn: string;     // Chinese name
  emoji: string;      // mood emoji for UI
  /** Accent color used for UI highlights / speech bubbles (HSL). */
  accent: string;
  /** Personality tagline shown in the picker. */
  tagline: string;
  src: string;
}

const A = (id: PetId, name: string, nameCn: string, emoji: string, accent: string, tagline: string): PetMeta => ({
  id,
  name,
  nameCn,
  emoji,
  accent,
  tagline,
  src: `/pets/animal-${id}.png`,
});

export const PETS: PetMeta[] = [
  A("cat",        "Cat",        "猫咪",   "🐱", "28 80% 55%",  "爱睡觉、爱蹭人"),
  A("dog",        "Dog",        "狗狗",   "🐶", "24 75% 55%",  "忠诚、活泼好动"),
  A("bunny",      "Bunny",      "兔兔",   "🐰", "330 70% 60%", "安静、喜欢被摸头"),
  A("panda",      "Panda",      "熊猫",   "🐼", "150 45% 50%", "慢悠悠、爱吃竹子"),
  A("fox",        "Fox",        "狐狸",   "🦊", "25 85% 55%",  "机灵、爱跑来跑去"),
  A("penguin",    "Penguin",    "企鹅",   "🐧", "200 60% 55%", "稳重、不怕冷"),
  A("tiger",      "Tiger",      "老虎",   "🐯", "35 80% 52%",  "威风、爱巡视"),
  A("lion",       "Lion",       "狮子",   "🦁", "38 75% 52%",  "王者风范"),
  A("monkey",     "Monkey",     "猴子",   "🐵", "40 70% 50%",  "调皮、爱跳跃"),
  A("koala",      "Koala",      "考拉",   "🐨", "130 35% 55%", "贪睡、慢节奏"),
  A("pig",        "Pig",        "小猪",   "🐷", "340 55% 60%", "憨厚、爱哼哼"),
  A("hog",        "Hog",        "野猪",   "🪿", "20 60% 45%",  "粗犷、爱拱地"),
  A("cow",        "Cow",        "奶牛",   "🐮", "30 50% 60%",  "温顺、慢吞吞"),
  A("deer",       "Deer",       "小鹿",   "🦌", "140 45% 55%", "优雅、警觉"),
  A("giraffe",    "Giraffe",    "长颈鹿", "🦒", "45 70% 55%",  "高个子、爱张望"),
  A("elephant",   "Elephant",   "大象",   "🐘", "210 30% 50%", "沉稳、记忆力好"),
  A("beaver",     "Beaver",     "海狸",   "🦫", "25 50% 45%",  "勤劳、爱筑坝"),
  A("parrot",     "Parrot",     "鹦鹉",   "🦜", "160 70% 50%", "爱说话、爱模仿"),
  A("chick",      "Chick",      "小鸡",   "🐤", "50 85% 60%",  "叽叽喳喳、爱跑"),
  A("caterpillar","Caterpillar","毛毛虫", "🐛", "90 60% 50%",  "慢慢爬、会变身"),
  A("bee",        "Bee",        "蜜蜂",   "🐝", "55 90% 55%",  "忙碌、嗡嗡飞"),
  A("fish",       "Fish",       "小鱼",   "🐟", "195 70% 55%", "安静、爱吐泡泡"),
  A("crab",       "Crab",       "螃蟹",   "🦀", "10 70% 55%",  "横着走、爱夹人"),
  A("polar",      "Polar Bear", "北极熊", "🐻‍❄️", "200 40% 60%", "高冷、爱发呆"),
];

export const PETS_BY_ID: Record<PetId, PetMeta> = PETS.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, {} as Record<PetId, PetMeta>);

export const DEFAULT_PET: PetId = "cat";

export function getPet(id: PetId): PetMeta {
  return PETS_BY_ID[id] ?? PETS_BY_ID[DEFAULT_PET];
}
