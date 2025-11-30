// src/pages/LandingPage.tsx

import React from "react";
import { useNavigate } from "react-router-dom";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const handlePlayNow = () => {
    navigate("/create");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-white relative px-4">
      {/* Фон */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-black via-black to-red-950/80" />

      {/* Лого + заголовок */}
      <div className="text-center space-y-5 mb-12">
        <div className="w-24 h-24 rounded-full border border-red-500/70 flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(239,68,68,0.9)]">
          <span className="text-5xl">♠</span>
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold tracking-[0.25em]">
          LINERA <span className="text-red-500">POKER</span>
        </h1>

        <p className="text-base md:text-lg text-gray-100 max-w-2xl mx-auto">
          On-chain Texas Hold&apos;em for degen grinders. Instant finality, fair
          dealing and transparent pots — powered by Linera&apos;s microchains.
        </p>
      </div>

      {/* Кнопка Play */}
      <button
        onClick={handlePlayNow}
        className="relative inline-flex items-center justify-center px-10 py-4 rounded-full bg-red-600 hover:bg-red-500 text-lg font-semibold shadow-[0_0_40px_rgba(239,68,68,0.9)] transition mb-10"
      >
        <span className="mr-2 text-xl">🎮</span> Play Tournament
      </button>

      {/* Фичи */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span>⚡</span> Instant Finality
          </h3>
          <p className="text-sm text-gray-100">
            No waiting for blocks. Hands resolve quickly thanks to Linera
            microchains and fast execution.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span>🧮</span> Transparent Pots
          </h3>
          <p className="text-sm text-gray-100">
            Every chip, every pot and every payout is verifiable on-chain.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span>🃏</span> Tournament Engine
          </h3>
          <p className="text-sm text-gray-100">
            Flexible structures: blinds, antes, rebuys, bounties and more —
            configured in seconds.
          </p>
        </div>
      </div>

      {/* Футер-текст */}
      <div className="mt-10 text-xs md:text-sm text-gray-400 text-center max-w-xl">
        <p>
          This is a non-custodial, testnet-only poker experience for Linera
          enthusiasts. No real-money gambling, only experiment and community
          fun.
        </p>
        <p className="mt-2">
          Built for devs, grinders and early adopters who want to try on-chain
          poker mechanics before mainnet.
        </p>
      </div>
    </div>
  );
};

export default LandingPage;
