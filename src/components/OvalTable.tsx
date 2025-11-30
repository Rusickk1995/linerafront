// src/components/OvalTable.tsx

import React from "react";
import type { Card } from "../legacy/poker/deck";

type Street = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";

type PlayerLike = {
  id: number;
  seatIndex: number; // 0-based
  name: string;
  stack: number;
  holeCards: Card[];
  hasFolded: boolean;
  isHero: boolean;
  bestHand?: { description: string };
};

type TableStateLike = {
  street: Street;
  pot: number;
  dealerSeatIndex: number;
};

type OvalTableProps = {
  players: PlayerLike[];
  tableState: TableStateLike;
  tableSize: number;
  board: Card[];
};

// Вычисляем координаты позиции по овалу
function computeSeatPosition(
  seatIndex: number,
  total: number
): { left: string; top: string } {
  // герой (seatIndex 0) — снизу по центру
  const startAngle = Math.PI / 2; // 90° вниз
  const step = (2 * Math.PI) / total;

  const angle = startAngle - seatIndex * step;

  // Радиусы овала (в процентах от контейнера)
  const radiusX = 40; // по ширине
  const radiusY = 32; // по высоте

  const centerX = 50;
  const centerY = 50;

  const left = centerX + radiusX * Math.cos(angle);
  const top = centerY + radiusY * Math.sin(angle);

  return {
    left: `${left}%`,
    top: `${top}%`,
  };
}

const OvalTable: React.FC<OvalTableProps> = ({
  players,
  tableState,
  tableSize,
  board,
}) => {
  const streetLabel =
    tableState.street === "waiting"
      ? "WAITING"
      : tableState.street.toUpperCase();

  return (
    <div className="relative w-full h-full">
      {/* Outer glow */}
      <div className="absolute inset-0 rounded-[999px] bg-gradient-to-br from-red-900/40 via-black/80 to-red-900/40 shadow-[0_0_80px_rgba(248,113,113,0.6)]" />

      {/* Felt */}
      <div className="absolute inset-[5%] md:inset-[6%] rounded-[999px] bg-gradient-to-b from-black/90 via-red-950/80 to-black/90 border border-red-500/50" />

      {/* Inner ring (контур стола) */}
      <div className="absolute inset-[13%] md:inset-[14%] rounded-[999px] border border-red-500/40 shadow-[0_0_50px_rgba(0,0,0,0.9)]" />

      {/* BOARD + POT в центре */}
      <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
        <div className="uppercase text-[10px] md:text-[11px] tracking-[0.25em] text-red-300 mb-2">
          BOARD
        </div>

        {/* 5 слотов под борд */}
        <div className="flex gap-2 md:gap-3 mb-2">
          {Array.from({ length: 5 }).map((_, i) => {
            const card = board[i];
            return (
              <div
                key={i}
                className={
                  "w-10 h-14 md:w-12 md:h-18 lg:w-14 lg:h-20 rounded-xl border border-red-500/60 bg-black/70 flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.9)] " +
                  (card ? "opacity-100" : "opacity-40")
                }
              >
                {card ? <CardView card={card} /> : null}
            </div>
          );
        })}
        </div>

        <div className="text-[10px] md:text-xs text-gray-300 mb-2">
          STREET: {streetLabel}
        </div>

        {/* POT */}
        <div className="mt-1 flex flex-col items-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-red-300 mb-1">
            POT
          </div>
          <div className="px-4 py-1.5 rounded-full bg-black/80 border border-red-500/60 shadow-[0_0_25px_rgba(248,113,113,0.9)] text-xs font-semibold">
            {tableState.pot.toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}
          </div>
        </div>
      </div>

      {/* Dealer button */}
      <div
        className={
          "absolute w-6 h-6 md:w-7 md:h-7 rounded-full bg-yellow-300 text-black text-[9px] md:text-[10px] flex items-center justify-center font-bold shadow-[0_0_10px_rgba(250,204,21,0.9)]"
        }
        style={computeSeatPosition(tableState.dealerSeatIndex, tableSize)}
      >
        D
      </div>

      {/* Players по овалу */}
      {players.map((p) => (
        <div
          key={p.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={computeSeatPosition(p.seatIndex, tableSize)}
        >
          <SeatView player={p} />
        </div>
      ))}
    </div>
  );
};

/* --------- Вспомогательные компоненты --------- */

const CardView: React.FC<{ card: Card }> = ({ card }) => {
  const isRed = card.suit === "♥" || card.suit === "♦";
  const rankChar = card.rank === "T" ? "10" : card.rank;

  return (
    <div className="flex flex-col items-center justify-center">
      <span
        className={
          "text-base font-semibold leading-none " +
          (isRed ? "text-red-300" : "text-gray-100")
        }
      >
        {rankChar}
      </span>
      <span className={isRed ? "text-red-400" : "text-gray-200"}>
        {card.suit}
      </span>
    </div>
  );
};

type SeatViewProps = {
  player: PlayerLike;
};

const SeatView: React.FC<SeatViewProps> = ({ player }) => {
  const hasCards = player.holeCards.length === 2;
  const showCards =
    hasCards && (player.isHero || !!player.bestHand);

  const cardContent = showCards ? (
    player.holeCards.map((c, idx) => (
      <div
        key={`${c.rank}${c.suit}${idx}`}
        className="w-9 h-13 md:w-10 md:h-14 rounded-xl border border-red-500/60 bg-black/80 flex items-center justify-center shadow-[0_0_18px_rgba(0,0,0,0.9)]"
      >
        <CardView card={c} />
      </div>
    ))
  ) : hasCards ? (
    <>
      <div className="w-9 h-13 md:w-10 md:h-14 rounded-xl border border-red-500/40 bg-red-900/70 shadow-[0_0_18px_rgba(0,0,0,0.9)]" />
      <div className="w-9 h-13 md:w-10 md:h-14 rounded-xl border border-red-500/40 bg-red-900/70 shadow-[0_0_18px_rgba(0,0,0,0.9)] -ml-4" />
    </>
  ) : (
    <div className="text-[10px] text-gray-500">Waiting...</div>
  );

  return (
    <div
      className={
        "bg-black/75 rounded-2xl px-3 py-2 flex flex-col gap-1 min-w-[120px] border " +
        (player.isHero
          ? "border-red-400 shadow-[0_0_20px_rgba(248,113,113,0.9)]"
          : "border-red-500/40")
      }
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[9px] uppercase tracking-[0.16em] text-red-300">
            SEAT {player.seatIndex + 1}
          </div>
          <div className="text-xs font-semibold text-white">
            {player.name}
          </div>
        </div>
        <div className="text-[10px] text-gray-300 text-right">
          {player.stack.toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })}{" "}
          chips
        </div>
      </div>

      <div className="flex items-center justify-between mt-1">
        <div className="flex gap-1">{cardContent}</div>

        {player.isHero && (
          <div className="ml-2 text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full bg-red-600/90 border border-red-300 shadow-[0_0_14px_rgba(248,113,113,0.9)] text-white">
            YOU
          </div>
        )}

        {player.bestHand && (
          <div className="ml-2 text-[9px] text-right text-gray-400 leading-tight">
            {player.bestHand.description}
          </div>
        )}
      </div>

      {player.hasFolded && (
        <div className="mt-1 text-[9px] text-red-400 uppercase tracking-[0.16em]">
          FOLDED
        </div>
      )}
    </div>
  );
};

export default OvalTable;
