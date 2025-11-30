// src/components/PlayerSeat.tsx

import React from "react";
import type { Card as PokerCard } from "../legacy/poker/deck";
import type { EvaluatedHand } from "../legacy/poker/handEvaluator";
import Card from "./Card";

type PlayerSeatProps = {
  id: number;
  name: string;
  isHero?: boolean;
  stack: number;
  bet: number;
  status: "active" | "folded" | "allin";
  isCurrent: boolean;
  cards: PokerCard[];
  bestHand?: EvaluatedHand;
};

const PlayerSeat: React.FC<PlayerSeatProps> = ({
  name,
  isHero,
  stack,
  bet,
  status,
  isCurrent,
  cards,
  bestHand,
}) => {
  const statusLabel =
    status === "folded" ? "Folded" : status === "allin" ? "All-in" : "Active";

  const statusClass =
    status === "folded"
      ? "text-gray-500"
      : status === "allin"
      ? "text-red-400"
      : "text-green-400";

  return (
    <div
      className={`rounded-xl border bg-black/40 p-3 flex flex-col gap-1 text-xs ${
        isCurrent
          ? "border-red-500 shadow-[0_0_25px_rgba(248,113,113,0.8)]"
          : "border-white/15"
      }`}
    >
      <div className="flex justify-between items-center">
        <span className="font-semibold">
          {name}
          {isHero && " (You)"}
        </span>
        <span className={`text-[10px] ${statusClass}`}>{statusLabel}</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-gray-300">
          Stack:{" "}
          <span className="font-semibold">{stack.toLocaleString()}</span>
        </span>
        <span className="text-gray-400">Bet: {bet}</span>
      </div>

      <div className="flex gap-1 mt-1">
        {cards.map((card, idx) => (
          <Card key={idx} card={card} size="md" dimmed={status === "folded"} />
        ))}
      </div>

      {bestHand && (
        <div className="mt-1 text-[10px] text-gray-300">
          Best: {bestHand.description}
        </div>
      )}
    </div>
  );
};

export default PlayerSeat;
