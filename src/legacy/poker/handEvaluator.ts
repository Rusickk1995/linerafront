// src/poker/handEvaluator.ts

import type { Card } from "./deck";
import { rankToValue } from "./deck";

export type HandCategory =
  | "high-card"
  | "one-pair"
  | "two-pair"
  | "three-of-a-kind"
  | "straight"
  | "flush"
  | "full-house"
  | "four-of-a-kind"
  | "straight-flush";

export type EvaluatedHand = {
  category: HandCategory;
  // чем выше значение, тем сильнее комбинация
  categoryRank: number; // 0..8
  // последовательность чисел для сравнения (категория уже вынесена)
  ranks: number[];
  description: string;
};

// ===== Вспомогалки =====

function sortDesc(values: number[]): number[] {
  return [...values].sort((a, b) => b - a);
}

function getCategoryRank(cat: HandCategory): number {
  switch (cat) {
    case "high-card":
      return 0;
    case "one-pair":
      return 1;
    case "two-pair":
      return 2;
    case "three-of-a-kind":
      return 3;
    case "straight":
      return 4;
    case "flush":
      return 5;
    case "full-house":
      return 6;
    case "four-of-a-kind":
      return 7;
    case "straight-flush":
      return 8;
  }
}

// ищем стрит в 5–7 картах по их числовым рангаvм
function detectStraight(values: number[]): number | null {
  const uniq = Array.from(new Set(values)).sort((a, b) => b - a);

  // A-5 (wheel) — туз также может быть 1
  if (uniq.includes(14)) {
    uniq.push(1);
  }

  let streak = 1;
  let bestHigh = 0;

  for (let i = 0; i < uniq.length - 1; i++) {
    if (uniq[i] === uniq[i + 1] + 1) {
      streak++;
      if (streak >= 5) {
        // high-карта 5-карточного отрезка
        bestHigh = uniq[i - 3];
      }
    } else {
      streak = 1;
    }
  }

  return bestHigh || null;
}

function evaluateFiveCards(cards: Card[]): EvaluatedHand {
  const values = cards.map((c) => rankToValue(c.rank)).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);

  // counts по рангу
  const counts = new Map<number, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }

  const entries = Array.from(counts.entries()).sort((a, b) => {
    // сортируем по количеству, потом по рангу
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const isFlush = new Set(suits).size === 1;
  const straightHigh = detectStraight(values);
  const isStraight = straightHigh !== null;

  // Straight flush
  if (isFlush && isStraight) {
    const cat: HandCategory = "straight-flush";
    return {
      category: cat,
      categoryRank: getCategoryRank(cat),
      ranks: [straightHigh!],
      description: `Straight flush, high ${straightHigh}`,
    };
  }

  // Four of a kind
  if (entries[0][1] === 4) {
    const fourRank = entries[0][0];
    const kicker = entries[1][0];
    const cat: HandCategory = "four-of-a-kind";
    return {
      category: cat,
      categoryRank: getCategoryRank(cat),
      ranks: [fourRank, kicker],
      description: `Four of a kind, ${fourRank}s`,
    };
  }

  // Full house
  if (entries[0][1] === 3 && entries[1] && entries[1][1] >= 2) {
    const triple = entries[0][0];
    const pair = entries[1][0];
    const cat: HandCategory = "full-house";
    return {
      category: cat,
      categoryRank: getCategoryRank(cat),
      ranks: [triple, pair],
      description: `Full house, ${triple}s full of ${pair}s`,
    };
  }

  // Flush
  if (isFlush) {
    const cat: HandCategory = "flush";
    return {
      category: cat,
      categoryRank: getCategoryRank(cat),
      ranks: sortDesc(values).slice(0, 5),
      description: "Flush",
    };
  }

  // Straight
  if (isStraight) {
    const cat: HandCategory = "straight";
    return {
      category: cat,
      categoryRank: getCategoryRank(cat),
      ranks: [straightHigh!],
      description: `Straight, high ${straightHigh}`,
    };
  }

  // Three of a kind
  if (entries[0][1] === 3) {
    const triple = entries[0][0];
    const kickers = entries
      .filter((e) => e[0] !== triple)
      .map((e) => e[0])
      .sort((a, b) => b - a)
      .slice(0, 2);

    const cat: HandCategory = "three-of-a-kind";
    return {
      category: cat,
      categoryRank: getCategoryRank(cat),
      ranks: [triple, ...kickers],
      description: `Three of a kind, ${triple}s`,
    };
  }

  // Two pair
  if (entries[0][1] === 2 && entries[1] && entries[1][1] === 2) {
    const highPair = Math.max(entries[0][0], entries[1][0]);
    const lowPair = Math.min(entries[0][0], entries[1][0]);
    const kicker = entries
      .filter((e) => e[0] !== highPair && e[0] !== lowPair)
      .map((e) => e[0])
      .sort((a, b) => b - a)[0];

    const cat: HandCategory = "two-pair";
    return {
      category: cat,
      categoryRank: getCategoryRank(cat),
      ranks: [highPair, lowPair, kicker],
      description: `Two pair, ${highPair}s and ${lowPair}s`,
    };
  }

  // One pair
  if (entries[0][1] === 2) {
    const pairRank = entries[0][0];
    const kickers = entries
      .filter((e) => e[0] !== pairRank)
      .map((e) => e[0])
      .sort((a, b) => b - a)
      .slice(0, 3);

    const cat: HandCategory = "one-pair";
    return {
      category: cat,
      categoryRank: getCategoryRank(cat),
      ranks: [pairRank, ...kickers],
      description: `One pair, ${pairRank}s`,
    };
  }

  // High card
  const cat: HandCategory = "high-card";
  return {
    category: cat,
    categoryRank: getCategoryRank(cat),
    ranks: sortDesc(values).slice(0, 5),
    description: "High card",
  };
}

// ===== Публичные функции =====

// Оценка лучшей 5-карточной руки из hole+board (2+5 = 7 карт)
export function evaluateBestHand(
  holeCards: Card[],
  board: Card[]
): EvaluatedHand {
  const all = [...holeCards, ...board];

  if (all.length < 5) {
    // не хватает карт — просто high card из того что есть
    return evaluateFiveCards(all);
  }

  // перебираем все сочетания 7 по 5 (макс 21 комбо)
  const indices = all.map((_, i) => i);
  const combos: Card[][] = [];

  for (let a = 0; a < indices.length - 4; a++) {
    for (let b = a + 1; b < indices.length - 3; b++) {
      for (let c = b + 1; c < indices.length - 2; c++) {
        for (let d = c + 1; d < indices.length - 1; d++) {
          for (let e = d + 1; e < indices.length; e++) {
            combos.push([all[a], all[b], all[c], all[d], all[e]]);
          }
        }
      }
    }
  }

  let best: EvaluatedHand | null = null;
  for (const combo of combos) {
    const evaled = evaluateFiveCards(combo);
    if (!best || compareHands(evaled, best) > 0) {
      best = evaled;
    }
  }

  return best!;
}

// Сравнение двух уже оценённых рук
export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.categoryRank !== b.categoryRank) {
    return a.categoryRank - b.categoryRank;
  }

  const len = Math.max(a.ranks.length, b.ranks.length);
  for (let i = 0; i < len; i++) {
    const av = a.ranks[i] ?? 0;
    const bv = b.ranks[i] ?? 0;
    if (av !== bv) return av - bv;
  }

  return 0;
}
