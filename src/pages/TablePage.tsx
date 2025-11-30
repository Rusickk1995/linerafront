// src/pages/TablePage.tsx
//
// Реальный ончейн-стол:
// - читает tableId из location.state (пока так);
// - грузит TableViewDto через fetchTable;
// - показывает простой вид стола;
// - кнопки действий шлют sendPlayerAction и обновляют состояние.
//
// Позже можно подвесить сюда OvalTable / PlayerSeat и т.д.

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Header from "../components/Header";
import {
  fetchTable,
  sendPlayerAction,
  type PlayerActionKindUi,
} from "../linera/lineraClient";
import type { OnChainTableViewDto } from "../types/onchain";

interface TablePageLocationState {
  tableId?: number;
  // на будущее — можно прокидывать ещё tournamentId / heroPlayerId и т.п.
  tournamentId?: number;
}

const TablePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const state = (location.state || {}) as TablePageLocationState;
  const tableId = state.tableId ?? null;

  const [table, setTable] = useState<OnChainTableViewDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTable(id: number) {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTable(id);
      setTable(data);
    } catch (e: any) {
      console.error("fetchTable failed", e);
      setError(e?.message ?? "Failed to load table from chain");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (tableId == null) {
      return;
    }
    loadTable(tableId);
  }, [tableId]);

  const handleAction = async (action: PlayerActionKindUi, amount?: number) => {
    if (tableId == null) return;
    setActionBusy(true);
    setError(null);
    try {
      const updated = await sendPlayerAction(tableId, action, amount);
      setTable(updated);
    } catch (e: any) {
      console.error("sendPlayerAction failed", e);
      setError(e?.message ?? "Failed to send action");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-50">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-5xl bg-slate-900/60 border border-slate-800 rounded-3xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Poker Table
              </h1>
              <p className="text-sm text-slate-400">
                Ончейн-стол Linera, стейт идёт из твоего Rust-движка.
              </p>
            </div>

            <button
              onClick={() => navigate(-1)}
              className="px-3 py-1.5 rounded-full border border-slate-700 text-sm text-slate-200 hover:border-slate-400 transition"
            >
              ← Назад
            </button>
          </div>

          {tableId == null ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <p>Нет tableId в state.</p>
              <p className="text-sm mt-2">
                Сюда нужно передавать tableId при навигации (например, после
                startTournament).
              </p>
            </div>
          ) : isLoading && !table ? (
            <div className="flex items-center justify-center h-64 text-slate-400">
              Загружаем состояние стола с блокчейна Linera...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-300 text-sm">
              <p>Ошибка: {error}</p>
              <button
                onClick={() => loadTable(tableId)}
                className="mt-4 px-4 py-2 rounded-full border border-red-500 text-red-200 hover:bg-red-500/10 transition"
              >
                Повторить
              </button>
            </div>
          ) : !table ? (
            <div className="flex items-center justify-center h-64 text-slate-400">
              Нет данных стола.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Инфо по столу */}
              <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    {table.name} (ID {table.table_id})
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Blinds {table.small_blind}/{table.big_blind}, ante{" "}
                    {table.ante}. Street: {table.street}. Pot:{" "}
                    {table.total_pot}.
                  </p>
                </div>
                <div className="text-xs text-slate-400">
                  <div>Max seats: {table.max_seats}</div>
                  <div>
                    Dealer button:{" "}
                    {table.dealer_button != null
                      ? table.dealer_button
                      : "—"}
                  </div>
                  <div>
                    Hand in progress: {table.hand_in_progress ? "Yes" : "No"}
                  </div>
                </div>
              </section>

              {/* Борд */}
              <section className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold mb-2">Board</h3>
                {table.board.length === 0 ? (
                  <p className="text-xs text-slate-500">Board is empty yet.</p>
                ) : (
                  <div className="flex gap-2">
                    {table.board.map((card, idx) => (
                      <div
                        key={idx}
                        className="w-10 h-14 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center text-sm"
                      >
                        {card.rank}
                        {card.suit}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Игроки */}
              <section className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold mb-3">Players</h3>
                {table.players.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No players at the table.
                  </p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {table.players.map((p) => {
                      const isActor =
                        table.current_actor_seat != null &&
                        table.current_actor_seat === p.seat_index;
                      return (
                        <div
                          key={p.player_id}
                          className={
                            "flex items-center justify-between rounded-xl px-3 py-2 border " +
                            (isActor
                              ? "border-emerald-400 bg-emerald-500/10"
                              : "border-slate-700 bg-slate-900")
                          }
                        >
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-100">
                              {p.display_name} (#{p.player_id})
                            </span>
                            <span className="text-slate-400">
                              Seat {p.seat_index} · {p.status}
                            </span>
                          </div>
                          <div className="text-right">
                            <div>Stack: {p.stack}</div>
                            <div>Bet: {p.current_bet}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Кнопки действий (пока простые) */}
              <section className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold mb-3">
                  Player actions (demo)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(["fold", "check", "call"] as PlayerActionKindUi[]).map(
                    (a) => (
                      <button
                        key={a}
                        disabled={actionBusy}
                        onClick={() => handleAction(a)}
                        className="px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-xs uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {a}
                      </button>
                    )
                  )}
                  {/* Для bet/raise понадобится amount – это сделаем отдельным шагом */}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default TablePage;
