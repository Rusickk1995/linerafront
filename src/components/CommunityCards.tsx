// src/components/CommunityCards.tsx

import React from "react";
import type { Card as PokerCard } from "../legacy/poker/deck";
import Card from "./Card";

type CommunityCardsProps = {
  board: PokerCard[];
};

const CommunityCards: React.FC<CommunityCardsProps> = ({ board }) => {
  if (!board || board.length === 0) {
    return (
      <div className="flex gap-2 justify-center min-h-[3.5rem] items-center text-xs text-gray-500">
        Board will appear here
      </div>
    );
  }

  return (
    <div className="flex gap-2 justify-center">
      {board.map((card, idx) => (
        <Card key={idx} card={card} size="md" />
      ))}
    </div>
  );
};

export default CommunityCards;
