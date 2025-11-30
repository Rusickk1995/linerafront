// src/components/Card.tsx

import React from "react";
import type { Card as PokerCard } from "../legacy/poker/deck";

type CardProps = {
  card: PokerCard;
  size?: "sm" | "md";
  dimmed?: boolean;
};

const Card: React.FC<CardProps> = ({ card, size = "md", dimmed = false }) => {
  const base =
    "rounded border border-white/20 bg-black/70 flex items-center justify-center select-none";
  const sizeClasses =
    size === "sm" ? "w-6 h-8 text-[10px]" : "w-8 h-12 text-sm";

  return (
    <div
      className={`${base} ${sizeClasses} ${
        dimmed ? "opacity-40" : "opacity-100"
      }`}
    >
      {card.rank}
      {card.suit}
    </div>
  );
};

export default Card;
