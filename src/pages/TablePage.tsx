// src/pages/TablePage.tsx
//
// Боевой ончейн-стол:
// - грузит состояние только из Linera (fetchTable → OnChainTableViewDto);
// - прогоняет через mapTableToUi (мэппер onchain → UI);
// - рендерит красивый стол через OvalTable;
// - обрабатывает действия игрока через sendPlayerAction.

import React, { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { fetchTable, sendPlayerAction } from "../linera/lineraClient";
import type { OnChainTableViewDto } from "../types/onchain";
import { mapTableToUi } from "../mappers/onchainToUi";
import OvalTable from "../components/OvalTable";

type TableLocationState = {
  tableId?: number;
  // на будущее можно добавить heroId, если будешь хранить его на фронте
};

type PlayerActionKindUi = "fold" | "check_or_call" | "bet" | "raise";

const TablePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as TableLocationState | undefined;

  const [tableId, setTableId] = useState<number | null>(state?.tableId ?? null);
  const [onchainView, setOnchainView] = useState<OnChainTableViewDto | null>(
    null,
  );
  const [uiView, setUiView] =
    useState<ReturnType<typeof mapTableToUi> | null>(null);

  const [loading, setLoading] = useState(false);
  const [commandLoading, setCommandLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [betAmount, setBetAmount] = useState<string>("");

  // Если вдруг зашли на /table без tableId в state — отправляем на лобби или лендинг.
  useEffect(() => {
    if (!tableId) {
      navigate("/"); // или "/lobby" когда заведёшь лобби-роут
    }
  }, [tableId, navigate]);

  const loadTable = useCallback(
    async (tid: number) => {
      try {
        setLoading(true);
        setError(null);

        const onchain = await fetchTable(tid);
        setOnchainView(onchain);

        const ui = mapTableToUi(onchain);
        setUiView(ui);
      } catch (e: any) {
        console.error("Failed to load table", e);
        setError(e?.message ?? "Failed to load table state");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (tableId != null) {
      loadTable(tableId);
    }
  }, [tableId, loadTable]);

  const handleSendAction = async (kind: PlayerActionKindUi) => {
    if (tableId == null) return;
    if (!uiView) return;

    setCommandLoading(true);
    setError(null);

    try {
      let action: "fold" | "check" | "call" | "bet" | "raise" = "fold";
      let amount: number | undefined;

      switch (kind) {
        case "fold":
          action = "fold";
          break;

        case "check_or_call":
          // если currentBet == 0 → check, иначе call
          action = uiView.currentBet > 0 ? "call" : "check";
          break;

        case "bet":
          action = "bet";
          amount = Number(betAmount) || 0;
          break;

        case "raise":
          action = "raise";
          amount = Number(betAmount) || 0;
          break;
      }

      // отправляем команду на ончейн
      await sendPlayerAction(tableId, action, amount);

      // после успешной команды перезагружаем состояние стола
      await loadTable(tableId);
    } catch (e: any) {
      console.error("Failed to send action", e);
      setError(e?.message ?? "Failed to send action");
    } finally {
      setCommandLoading(false);
    }
  };

  if (!tableId) {
    return null;
  }

  const isBusy = loading || commandLoading;

  const potLabel = uiView ? uiView.pot.toLocaleString() : "0";
  const currentBetLabel = uiView
    ? uiView.currentBet.toLocaleString()
    : "0";

  const heroId = uiView?.heroId;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white flex flex-col">
      {/* Хедер / верхняя панель */}
      <header className="w-full border-b border-white/10 bg-black/60 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-2 py-1 text-xs rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 transition"
            >
              ← Back
            </button>
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 uppercase tracking-[0.2em]">
                Linera Poker / Table
              </span>
              <span className="text-sm font-semibold">
                Table #{tableId}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="px-3 py-1 rounded-full bg-black/60 border border-white/15">
              Pot:{" "}
              <span className="font-semibold">{potLabel}</span>
            </div>
            <div className="px-3 py-1 rounded-full bg-black/60 border border-white/15">
              Current bet:{" "}
              <span className="font-semibold">
                {currentBetLabel}
              </span>
            </div>
            {heroId && (
              <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/60 text-emerald-300">
                You: <span className="font-semibold">{heroId}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Основная область: стол + панель действий */}
      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-6 gap-4">
        {/* Статусы загрузки / ошибок */}
        {(loading || commandLoading) && (
          <div className="text-xs text-gray-400">
            {loading ? "Loading table state..." : "Sending action..."}
          </div>
        )}
        {error && (
          <div className="text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Стол */}
        <div className="relative w-full flex-1 min-h-[420px] md:min-h-[520px]">
          {uiView ? (
            <OvalTable
              players={uiView.players}
              communityCards={uiView.communityCards}
              pot={uiView.pot}
              currentBet={uiView.currentBet}
              street={uiView.street}
              heroId={uiView.heroId}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">
              No table data yet
            </div>
          )}
        </div>

        {/* Панель действий игрока */}
        <section className="mt-4 border-t border-white/10 pt-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={isBusy}
                onClick={() => handleSendAction("fold")}
                className="px-4 py-2 rounded-xl border border-red-500/60 bg-red-500/10 text-sm hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Fold
              </button>

              <button
                disabled={isBusy}
                onClick={() => handleSendAction("check_or_call")}
                className="px-4 py-2 rounded-xl border border-slate-500/60 bg-slate-500/10 text-sm hover:bg-slate-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {uiView && uiView.currentBet > 0 ? "Call" : "Check"}
              </button>

              <button
                disabled={isBusy || !betAmount}
                onClick={() => handleSendAction("bet")}
                className="px-4 py-2 rounded-xl border border-emerald-500/60 bg-emerald-500/10 text-sm hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Bet
              </button>

              <button
                disabled={isBusy || !betAmount}
                onClick={() => handleSendAction("raise")}
                className="px-4 py-2 rounded-xl border border-amber-500/60 bg-amber-500/10 text-sm hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Raise
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-300">
              <span>Amount</span>
              <input
                type="number"
                min={0}
                step={1}
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="w-28 px-3 py-1.5 rounded-lg bg-black/70 border border-white/15 text-sm outline-none focus:border-red-400"
                placeholder="Size"
              />
              <button
                disabled={isBusy}
                onClick={() => tableId && loadTable(tableId)}
                className="px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-xs disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Refresh
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default TablePage;
