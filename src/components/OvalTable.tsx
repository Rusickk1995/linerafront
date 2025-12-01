// src/components/OvalTable.tsx
//
// Красивая визуализация стола.
// Сейчас компонент полностью UI-ной природы и не знает про legacy-движок:
// - использует Player / UICard из src/types/poker;
// - может быть подвешен к on-chain данным через мапперы.

import React from "react";
import type { Player, UICard } from "../types/poker";
import CommunityCards from "./CommunityCards";
import PlayerSeat from "./PlayerSeat";

type Street = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";

type OvalTableProps = {
  players: Player[];
  communityCards: UICard[];
  pot: number;
  currentBet: number;
  street: Street;
  /** id героя (для подсветки) — обычно то, что ты знаешь из auth/сессии */
  heroId?: string;
};

const OvalTable: React.FC<OvalTableProps> = ({
  players,
  communityCards,
  pot,
  currentBet,
  street,
  heroId,
}) => {
  const streetLabel =
    street === "waiting" ? "WAITING" : street.toUpperCase();

  const sortedPlayers = [...players].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );

  const hero = heroId
    ? sortedPlayers.find((p) => p.id === heroId)
    : undefined;

  const others = hero
    ? sortedPlayers.filter((p) => p.id !== hero.id)
    : sortedPlayers;

  // Простейший сплит: половина игроков сверху, половина снизу
  const half = Math.ceil(others.length / 2);
  const topRow = others.slice(0, half);
  const bottomRow = others.slice(half);

  return (
    <div className="relative w-full h-full min-h-[480px] md:min-h-[560px]">
      {/* Внешний glow */}
      <div className="absolute inset-0 rounded-[999px] bg-gradient-to-br from-black via-rose-950/80 to-black shadow-[0_0_80px_rgba(248,113,113,0.6)]" />

      {/* Фетр стола */}
      <div className="absolute inset-[5%] md:inset-[6%] rounded-[999px] bg-gradient-to-br from-black via-slate-950 to-black border border-red-500/50" />

      {/* Внутреннее кольцо */}
      <div className="absolute inset-[13%] md:inset-[14%] rounded-[999px] border border-red-500/40 shadow-[0_0_50px_rgba(0,0,0,0.9)]" />

      {/* Центральная область: банк, борд, статус раздачи */}
      <div className="absolute inset-[18%] md:inset-[19%] flex flex-col items-center justify-center gap-4">
        {/* Статус и банк */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] tracking-[0.25em] uppercase text-red-400">
            {streetLabel}
          </span>
          <div className="flex items-center gap-4 text-xs text-gray-200">
            <div className="px-3 py-1 rounded-full bg-black/60 border border-white/15">
              Pot:{" "}
              <span className="font-semibold">{pot.toLocaleString()}</span>
            </div>
            <div className="px-3 py-1 rounded-full bg-black/60 border border-white/15">
              Current bet:{" "}
              <span className="font-semibold">
                {currentBet.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Community cards */}
        <CommunityCards board={communityCards} />
      </div>

      {/* Верхний ряд игроков */}
      <div className="absolute top-[8%] left-[8%] right-[8%] flex justify-between gap-2">
        {topRow.map((p) => (
          <div key={p.id} className="flex-1 flex justify-center">
            <PlayerSeat
              player={p}
              isCurrent={false}
              isHero={heroId === p.id}
              bet={0}
            />
          </div>
        ))}
      </div>

      {/* Нижний ряд игроков (включая героя) */}
      <div className="absolute bottom-[6%] left-[6%] right-[6%] flex justify-between gap-3 items-end">
        {bottomRow.map((p) => (
          <div key={p.id} className="flex-1 flex justify-center">
            <PlayerSeat
              player={p}
              isCurrent={false}
              isHero={heroId === p.id}
              bet={0}
            />
          </div>
        ))}

        {hero && (
          <div className="flex-1 flex justify-center">
            <PlayerSeat
              player={hero}
              isCurrent={true}
              isHero={true}
              bet={0}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default OvalTable;
