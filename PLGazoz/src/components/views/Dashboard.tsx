import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { SystemData } from "../../types/system";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Square,
  RefreshCcw,
  ShieldAlert,
  Cpu,
  AlertTriangle,
  Unlock,
  Shield,
  Target,
  RefreshCw,
  Lock,
  Droplet,
  Database,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface DashboardProps {
  data: SystemData;
  onStart: () => void;
  onStop: () => void;
  onStartWashing: () => void;
  onStopWashing: () => void;
  onResetCounter: (target: "input" | "output") => void;
  onSelectRecipe: (id: string) => void;
  onAnswerPrompt: (answer: boolean) => void;
  onStopAfterCycle: () => void;
  onRefillSyrup?: () => void;
}

export function Dashboard({
  data,
  onStart,
  onStop,
  onStopAfterCycle,
  onStartWashing,
  onStopWashing,
  onResetCounter,
  onSelectRecipe,
  onAnswerPrompt,
  onRefillSyrup,
}: DashboardProps) {
  const isAuto = data.mode === "OTOMATİK";
  const isWashing = data.mode === "YIKAMA";

  const activeRecipe =
    data.recipes.find((r) => r.id === data.config.recipeId) || data.recipes[0];

  const autoStateLabels: Record<string, string> = {
    BEKLEMEDE: "Beklemede",
    GIRIS_SAYILIYOR: "Giriş Sayılıyor",
    GIRIS_KILITLI: "Giriş Kapısı Kilitleniyor",
    DENGELEME: "Sıvı / Titreşim Dengeleniyor",
    DOLUM: "Valfler Açık (Dolum)",
    DAMLA_BEKLEME: "Damlama Bekleniyor",
    TAHLIYE: "Çıkış Açık (Boşaltım)",
    DOGRULAMA: "Döngü Pasaportu Doğrulanıyor",
  };

  const progress =
    isAuto && data.config.targetCount > 0
      ? Math.min(
          100,
          Math.round(
            ((data.autoState === "TAHLIYE" || data.autoState === "DOGRULAMA"
              ? data.outputCount
              : data.inputCount) /
              data.config.targetCount) *
              100,
          ),
        )
      : 0;

  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden">
      {/* Top action bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-[#151921] border border-[#374151] p-3 rounded shadow-lg flex-shrink-0 gap-4 md:gap-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-sm font-bold tracking-tight text-white flex items-center">
              {isAuto ? (
                <>
                  <RefreshCcw
                    className="mr-2 text-green-400 animate-spin-slow"
                    size={14}
                  />{" "}
                  Üretim Devam Ediyor
                </>
              ) : isWashing ? (
                <>
                  <Droplet
                    className="mr-2 text-blue-400 animate-bounce"
                    size={14}
                  />{" "}
                  Yıkama Modu Aktif
                </>
              ) : (
                <>
                  <Square className="mr-2 text-gray-500" size={14} /> Hazır
                  Durumda
                </>
              )}
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
              {isWashing
                ? "Tüm Valfler Pulsing Modunda Çalkalanıyor"
                : autoStateLabels[data.autoState] || data.autoState}
              {isAuto && (
                <span className="ml-2 text-blue-400 font-bold">
                  ({progress}%)
                </span>
              )}
            </p>
          </div>

          {!isAuto && !isWashing && (
            <div
              className={cn(
                "px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1.5",
                data.isWashingDone
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]",
              )}
            >
              {data.isWashingDone ? (
                <Shield size={10} />
              ) : (
                <AlertTriangle size={10} />
              )}
              {data.isWashingDone ? "YIKAMA TAMAM" : "YIKAMA GEREKLİ"}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {!isWashing && !isAuto && (
            <button
              onClick={onStartWashing}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#1e1b4b] border border-[#312e81] hover:bg-[#312e81] text-blue-400 px-4 md:px-6 py-2 rounded font-bold text-[11px] transition-all shadow-md active:scale-95 whitespace-nowrap"
            >
              <Droplet size={14} />
              <span>YIKAMAYI BAŞLAT</span>
            </button>
          )}

          {isWashing && (
            <button
              onClick={onStopWashing}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600/20 border border-blue-500 hover:bg-blue-600/40 text-blue-400 px-4 md:px-6 py-2 rounded font-bold text-[11px] transition-all whitespace-nowrap"
            >
              <Square size={14} />
              <span>YIKAMAYI DURDUR</span>
            </button>
          )}

          <button
            onClick={onStart}
            disabled={
              isAuto ||
              isWashing ||
              data.mode === "ARIZA" ||
              data.mode === "BASLATMA"
            }
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#052e16] border border-[#14532d] hover:bg-[#14532d] disabled:opacity-50 disabled:cursor-not-allowed text-[#4ade80] px-4 md:px-8 py-2 rounded font-bold text-[11px] transition-all shadow-lg active:scale-95 whitespace-nowrap"
          >
            <Play size={14} />
            <span>ÜRETİMİ BAŞLAT</span>
          </button>

          {isAuto && (
            <button
              onClick={onStopAfterCycle}
              className={cn(
                "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 rounded font-bold text-[11px] transition-all active:scale-95 border whitespace-nowrap",
                data.stopAfterCycleRequested
                  ? "bg-amber-600/20 border-amber-500 text-amber-500 animate-pulse"
                  : "bg-orange-900/40 border-orange-800 hover:bg-orange-900 text-orange-500",
              )}
            >
              <RefreshCw
                size={14}
                className={cn(data.stopAfterCycleRequested && "animate-spin")}
              />
              <span>
                {data.stopAfterCycleRequested
                  ? "DÖNGÜ SONU..."
                  : "BEKLEME MODU"}
              </span>
            </button>
          )}

          <button
            onClick={onStop}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-900/40 border border-red-800 hover:bg-red-900 text-red-500 px-4 md:px-6 py-2 rounded font-bold text-[11px] transition-all active:scale-95 whitespace-nowrap"
          >
            <ShieldAlert size={14} />
            <span>ACİL DURDUR</span>
          </button>
        </div>
      </div>

      {/* Main Flow Visualization */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        {/* Left Column: Flow representation */}
        <div className="col-span-12 lg:col-span-8 bg-[#151921] border border-[#2D333F] rounded p-3 flex flex-col relative overflow-hidden shadow-inner min-h-[400px]">
          <h2 className="text-[10px] font-bold text-gray-400 mb-2 border-l-2 border-[#F97316] pl-2 flex items-center">
            <Cpu size={12} className="mr-2" /> Görsel Akış Kontrolü
          </h2>

          <div className="flex-1 flex flex-col min-h-0 relative w-full pt-2 border-b border-[#2D333F]/40 pb-3 mb-2">
            {/* Conveyor & Counters Area */}
            <div className="flex-1 flex flex-col justify-between items-center relative min-h-0 w-full">
              {/* Target / Progress Line */}
            <div className="w-full flex justify-between px-8 mb-6 z-20">
              <div className="bg-[#0D1016] p-2 rounded border border-[#1F2937] text-center w-24 relative flex flex-col items-center">
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div
                    className={cn(
                      "w-6 h-1 rounded-full",
                      data.sensors.find((s) => s.id == "SENS-IN")?.enabled
                        ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"
                        : "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]",
                    )}
                  />
                </div>
                <div className="text-[10px] text-gray-500 mb-1 font-bold">
                  GİRİŞ
                </div>
                <div className="text-2xl font-mono text-[#F97316] leading-none">
                  {data.inputCount}
                </div>
              </div>
              <div className="bg-[#1e1b4b] p-2 rounded border border-[#312e81] text-center w-24">
                <div className="text-[10px] text-gray-400 mb-1 font-bold">
                  HEDEF
                </div>
                <div className="text-2xl font-mono text-blue-400 leading-none">
                  {data.config.targetCount}
                </div>
              </div>
              <div className="bg-[#0D1016] p-2 rounded border border-[#1F2937] text-center w-24 relative flex flex-col items-center">
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div
                    className={cn(
                      "w-6 h-1 rounded-full",
                      data.sensors.find((s) => s.id == "SENS-OUT")?.enabled
                        ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"
                        : "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]",
                    )}
                  />
                </div>
                <div className="text-[10px] text-gray-500 mb-1 font-bold">
                  ÇIKIŞ
                </div>
                <div className="text-2xl font-mono text-green-400 leading-none">
                  {data.outputCount}
                </div>
              </div>
            </div>

            {/* Conveyor graphic */}
            <div className="w-full mt-4 mb-24 h-48 border-y-4 border-[#374151] bg-[#0D1016]/50 flex items-center justify-between px-16 relative">
              {/* Input Gate */}
              <div className="absolute left-10 -bottom-20 flex flex-col items-center z-20">
                <div className="h-44 w-6 flex items-end overflow-hidden">
                  <motion.div
                    initial={false}
                    animate={{ y: data.inputGate.isOpen ? "100%" : "0%" }}
                    transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                    className={cn(
                      "w-full h-32 rounded-t-md transition-colors border-2",
                      data.inputGate.isOpen
                        ? "bg-green-500/80 border-green-400"
                        : "bg-red-500 border-red-700",
                    )}
                  />
                </div>
                <div className="w-16 h-14 bg-[#1C2029] border-2 border-[#3E4C59] rounded-b-lg flex flex-col items-center justify-center z-10 shadow-xl relative -top-2">
                  <div className="absolute -top-3.5 bg-[#151921] rounded-full p-1 z-20 flex items-center justify-center h-7 w-7 shadow-lg border border-[#374151]">
                    <Lock
                      size={14}
                      className={cn(
                        data.inputGate.isOpen
                          ? "text-green-500 hidden"
                          : "text-red-500",
                      )}
                    />
                    <Unlock
                      size={14}
                      className={cn(
                        data.inputGate.isOpen ? "text-green-500" : "hidden",
                      )}
                    />
                  </div>
                  <div
                    className={cn(
                      "w-6 h-2 rounded-full mb-1",
                      data.inputGate.isOpen
                        ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"
                        : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]",
                    )}
                  />
                  <div className="text-[9px] text-gray-500 font-bold tracking-wider leading-none">
                    GİRİŞ
                  </div>
                </div>
              </div>

              {/* Valves */}
              <div className="absolute left-32 right-32 top-2 flex justify-between px-2 -mt-1 z-10">
                {[...data.valves].reverse().map((valve, i) => (
                  <div
                    key={valve.id}
                    className="flex flex-col items-center w-10"
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded shadow-md border-2 relative transition-colors flex items-center justify-center",
                        valve.isOpen || data.mode === "YIKAMA"
                          ? data.mode === "YIKAMA"
                            ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_12px_rgba(59,130,246,0.6)]"
                            : "bg-fuchsia-600 border-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.8)] text-white"
                          : "bg-[#2D333F] border-[#1F2937] text-gray-500",
                      )}
                    >
                      <span className="text-[10px] font-bold">V{valve.id}</span>
                    </div>
                    <div className="w-2.5 h-6 bg-[#1F2937] mt-1 rounded-b-sm relative z-20" />
                    {/* Fluid drip animation */}
                    <AnimatePresence>
                      {(valve.isOpen || data.mode === "YIKAMA") && (
                        <motion.div
                          initial={{ height: 0, opacity: 1 }}
                          animate={{ height: 60, opacity: 0 }}
                          transition={{
                            repeat: Infinity,
                            duration: data.mode === "YIKAMA" ? 0.3 : 0.5,
                          }}
                          className={cn(
                            "w-1.5 mt-0.5 absolute top-[60px] rounded-full z-10",
                            data.mode === "YIKAMA"
                              ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]"
                              : "bg-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.6)]",
                          )}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>

              {/* Output Gate */}
              <div className="absolute right-10 -bottom-20 flex flex-col items-center z-20">
                <div className="h-44 w-6 flex items-end overflow-hidden">
                  <motion.div
                    initial={false}
                    animate={{ y: data.outputGate.isOpen ? "100%" : "0%" }}
                    transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                    className={cn(
                      "w-full h-32 rounded-t-md transition-colors border-2",
                      data.outputGate.isOpen
                        ? "bg-green-500/80 border-green-400"
                        : "bg-red-500 border-red-700",
                    )}
                  />
                </div>
                <div className="w-16 h-14 bg-[#1C2029] border-2 border-[#3E4C59] rounded-b-lg flex flex-col items-center justify-center z-10 shadow-xl relative -top-2">
                  <div className="absolute -top-3.5 bg-[#151921] rounded-full p-1 z-20 flex items-center justify-center h-7 w-7 shadow-lg border border-[#374151]">
                    <Lock
                      size={14}
                      className={cn(
                        data.outputGate.isOpen
                          ? "text-green-500 hidden"
                          : "text-red-500",
                      )}
                    />
                    <Unlock
                      size={14}
                      className={cn(
                        data.outputGate.isOpen ? "text-green-500" : "hidden",
                      )}
                    />
                  </div>
                  <div
                    className={cn(
                      "w-6 h-2 rounded-full mb-1",
                      data.outputGate.isOpen
                        ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"
                        : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]",
                    )}
                  />
                </div>
              </div>

              <div className="absolute left-32 right-32 bottom-0 flex justify-between px-2 z-0">
                {[...data.valves].reverse().map((valve) => {
                  const activeRecipe = data.recipes.find(r => r.id === data.config.recipeId);
                  const activeValves = activeRecipe?.activeValves || [1, 2, 3, 4, 5, 6, 7, 8];
                  const sortedActiveValves = [...activeValves].sort((a, b) => a - b);
                  const rank = sortedActiveValves.indexOf(valve.id);
                  const targetCount = sortedActiveValves.length;

                  // Determine if a bottle is present at this position on the conveyor
                  const hasBottle = rank !== -1 && (
                    data.mode === "OTOMATİK"
                      ? data.autoState === "GIRIS_SAYILIYOR"
                        ? rank < data.inputCount
                        : data.autoState === "TAHLIYE"
                          ? rank >= data.outputCount && rank < targetCount
                          : rank < targetCount
                      : data.inputCount > 0 && rank < targetCount
                  );

                  // If valve is currently open (filling) or if in wash/cleaning
                  const isFillingNow =
                    valve.isOpen || (data.mode === "YIKAMA" && valve.enabled);

                  // Bottle is filled if it has been through the cycle
                  const isFilled =
                    data.mode === "OTOMATİK"
                      ? ["DAMLA_BEKLEME", "TAHLIYE", "DOGRULAMA"].includes(
                          data.autoState,
                        )
                      : data.outputCount > 0 ||
                        isFillingNow ||
                        rank < data.outputCount;

                  const isLargeLine = data.valves.length > 8;

                  return (
                    <div
                      key={"bottle-" + valve.id}
                      className={cn(
                        "flex justify-center transition-all duration-300",
                        isLargeLine ? "w-6" : "w-10",
                      )}
                    >
                      {hasBottle ? (
                        <motion.div
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 15 }}
                          className={cn(
                            "relative flex flex-col items-center select-none transition-all duration-300",
                            isLargeLine ? "w-6 h-16" : "w-10 h-24",
                          )}
                        >
                          {/* Crown Cap - Metallic Gold */}
                          <div
                            className={cn(
                              "bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 border-b border-amber-600 shadow-sm z-20 flex items-end justify-center",
                              isLargeLine
                                ? "h-1 w-2.5 rounded-t-[1px]"
                                : "h-1.5 w-4 rounded-t-sm",
                            )}
                          >
                            <div className="flex justify-between w-full px-[1px] opacity-65">
                              <span className="w-[1px] h-[1px] bg-amber-800 rounded-full" />
                              <span className="w-[1px] h-[1px] bg-amber-800 rounded-full" />
                              <span className="w-[1px] h-[1px] bg-amber-800 rounded-full" />
                            </div>
                          </div>

                          {/* Glass Neck */}
                          <div
                            className={cn(
                              "bg-emerald-400/15 border-x border-emerald-400/30 relative z-10",
                              isLargeLine ? "w-1.5 h-2.5" : "w-2.5 h-4",
                            )}
                          />

                          {/* Upper body shoulder slope */}
                          <div
                            className={cn(
                              "bg-gradient-to-b from-emerald-500/10 to-emerald-700/15 border-x border-teal-400/30 relative z-10",
                              isLargeLine
                                ? "w-2.5 h-1 ml-[-2px] mr-[-2px] border-t rounded-t"
                                : "w-6 h-2 ml-[-4px] mr-[-4px] border-t rounded-t-lg",
                            )}
                          />

                          {/* Main Glass Body */}
                          <div
                            className={cn(
                              "bg-gradient-to-b from-emerald-400/10 to-teal-800/15 rounded-t-md rounded-b border-x border-b border-teal-400/30 shadow-md relative overflow-hidden flex flex-col items-center justify-start",
                              isLargeLine
                                ? "w-5 h-9 -mt-[1px]"
                                : "w-9 h-15 -mt-[1px]",
                            )}
                          >
                            {/* Vertical Glass Highlight Sheen */}
                            <div className="absolute top-0 bottom-0 left-0.5 w-[2px] bg-white/15 blur-[0.2px] z-10 pointer-events-none" />

                            {/* Liquid Content */}
                            <motion.div
                              initial={{ height: "0%" }}
                              animate={{
                                height: isFilled
                                  ? "82%"
                                  : isFillingNow
                                    ? "55%"
                                    : "0%",
                              }}
                              transition={{ duration: 1, ease: "easeInOut" }}
                              className={cn(
                                "absolute bottom-0 left-0 right-0 z-0 bg-gradient-to-t transition-all",
                                data.mode === "YIKAMA"
                                  ? "from-blue-400/50 to-blue-300/30"
                                  : "from-amber-600/40 via-amber-500/35 to-yellow-400/15",
                              )}
                            />

                            {/* Bubbles Rise Effect */}
                            {isFilled && data.mode !== "YIKAMA" && (
                              <div className="absolute inset-x-0 bottom-0 top-2 z-1 pointer-events-none overflow-hidden opacity-75">
                                <span className="absolute bottom-1 left-1.5 w-0.5 h-0.5 bg-white/40 rounded-full animate-ping [animation-duration:1.5s] [animation-delay:0.1s]" />
                                <span className="absolute bottom-3 right-1.5 w-0.5 h-0.5 bg-white/40 rounded-full animate-ping [animation-duration:2s] [animation-delay:0.3s]" />
                                <span className="absolute bottom-5 left-2 w-0.5 h-[1px] bg-white/30 rounded-full animate-ping [animation-duration:1.2s] [animation-delay:0.5s]" />
                              </div>
                            )}

                            {/* Elegant label - "Palandöken Gazoz" */}
                            <div
                              className={cn(
                                "absolute bg-gradient-to-r from-red-600 to-red-500 border-y border-white/20 py-0.5 z-10 flex flex-col items-center justify-center leading-none rounded-xs select-none shadow-sm left-[1px] right-[1px] transition-all duration-300",
                                isLargeLine
                                  ? "top-[15%] h-[12px]"
                                  : "top-[25%] h-[24px]",
                              )}
                            >
                              <span
                                className={cn(
                                  "font-black text-white leading-none font-sans uppercase text-center scale-90 block",
                                  isLargeLine
                                    ? "text-[2.2px] tracking-normal"
                                    : "text-[4.5px] tracking-wider",
                                )}
                              >
                                PALANDÖKEN
                              </span>
                              <span
                                className={cn(
                                  "font-black text-yellow-300 leading-none font-bold uppercase text-center scale-90 block mt-[0.5px]",
                                  isLargeLine ? "text-[2px]" : "text-[4px]",
                                )}
                              >
                                GAZOZ
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <div className={cn(isLargeLine ? "h-16" : "h-24")} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Terminal Logs */}
          <div className="w-full bg-[#0A0D14] p-3 border-t border-[#2D333F] h-42 overflow-y-auto mt-auto flex-shrink-0 custom-scrollbar">
            <h3 className="text-[10px] font-bold text-gray-400 mb-2 border-b border-[#1F2937] pb-1 sticky top-0 bg-[#0A0D14] z-10 flex items-center justify-between">
              <span>SİSTEM DURUMU / HABERLEŞME MESAJLARI</span>
              {data.activeAlerts.filter((a) => !a.resolved).length > 0 && (
                <span className="text-red-400 text-[8px] font-black animate-pulse flex items-center gap-1 bg-red-950/40 border border-red-900 rounded px-1.5 py-0.5">
                  <AlertTriangle size={8} /> {data.activeAlerts.filter((a) => !a.resolved).length} AKTİF UYARI
                </span>
              )}
            </h3>
            <div className="space-y-1 font-mono text-[9px]">
              {/* Active Alerts displayed in system status / comms box as requested */}
              {data.activeAlerts.filter((a) => !a.resolved).map((alert, i) => (
                <div
                  key={"term-alert-" + (alert.id || i)}
                  className={cn(
                    "flex items-start gap-2 p-1.5 rounded mb-2 border text-[10px]",
                    alert.severity === "CRITICAL"
                      ? "bg-red-950/50 border-red-900/60 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.1)]"
                      : "bg-amber-950/40 border-amber-900/60 text-amber-400"
                  )}
                >
                  <AlertTriangle size={11} className="mt-0.5 shrink-0 text-red-400 animate-pulse" />
                  <div className="flex-1">
                    <span className="font-extrabold uppercase">[{alert.severity}] {alert.code}</span>
                    <span className="mx-1">:</span>
                    <span>{alert.message}</span>
                    {alert.suggestion && (
                      <span className="block text-[8px] text-gray-400 font-sans mt-0.5">
                        Öneri: {alert.suggestion}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {data.terminalLogs.slice(0, 30).map((log, i) => (
                <div
                  key={i}
                  className={
                    log.includes("ERR") ? "text-red-400 font-bold" : "text-emerald-400/85"
                  }
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Status & Alerts */}
        <div className="col-span-12 lg:col-span-4 flex flex-col space-y-3 min-h-0">
          {/* Scrollable Recipe Selector */}
          <div className="bg-[#151921] p-3 rounded border border-[#2D333F] flex-shrink-0 flex flex-col h-[230px] overflow-hidden">
            <h2 className="text-[10px] uppercase font-bold text-gray-400 mb-2 border-l-2 border-blue-500 pl-2 flex items-center justify-between">
              <span className="flex items-center">
                <Database size={12} className="mr-2 text-blue-400" /> REÇETE
                SEÇİMİ
              </span>
              <span className="text-[8px] font-mono text-gray-500">
                {isAuto || isWashing
                  ? "KİLİTLİ"
                  : `[${data.recipes.length} REÇETE]`}
              </span>
            </h2>

            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1 mt-1">
              {data.recipes.map((recipe) => {
                const isActive = data.config.recipeId === recipe.id;
                const isDisabled = isAuto || isWashing;
                return (
                  <button
                    key={recipe.id}
                    disabled={isDisabled}
                    onClick={() => onSelectRecipe(recipe.id)}
                    className={cn(
                      "w-full text-left p-2 rounded border transition-all flex items-center justify-between gap-2",
                      isActive
                        ? "bg-blue-900/20 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                        : "bg-[#0D1016] border-[#2D333F] hover:border-gray-555 text-gray-300",
                      isDisabled &&
                        !isActive &&
                        "opacity-45 cursor-not-allowed",
                    )}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span
                        className={cn(
                          "text-[10px] font-bold truncate",
                          isActive ? "text-blue-400" : "text-gray-200",
                        )}
                      >
                        {recipe.name}
                      </span>
                      <span className="text-[8px] font-mono text-gray-500 mt-1 flex items-center gap-2">
                        <span>{recipe.volumeMl} ml</span>
                        <span>·</span>
                        <span>{recipe.targetCount} Adet</span>
                        <span>·</span>
                        <span>{recipe.fillTimeMs / 1000}s</span>
                      </span>
                    </div>
                    {isActive && (
                      <div className="p-0.5 bg-blue-500 rounded-full shrink-0">
                        <Shield size={8} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right box: 50L Syrup Tank & Laser Level Sensor */}
          <div className="bg-[#151921] p-3 rounded border border-[#2D333F] flex-shrink-0 flex flex-col items-center justify-start relative select-none">
            <span className="text-[10px] uppercase font-bold text-gray-400 mb-2 border-l-2 border-amber-500 pl-2 flex items-center justify-between w-full">
              <span className="flex items-center gap-1">
                <Droplet size={11} className="text-amber-400 animate-pulse" /> ŞERBET DEPOSU
              </span>
              <span className="text-[8px] font-mono text-gray-500">LAZER SENSÖRLÜ</span>
            </span>

            {/* Cylindrical Syrup Tank representation */}
            <div className="relative w-24 h-40 bg-[#0B0D13] border-2 border-slate-700/80 rounded-2xl flex flex-col justify-end overflow-hidden shadow-inner mt-2">
              {/* Laser sensor device at top */}
              <div className="absolute top-0 inset-x-0 h-4 bg-slate-800 border-b border-slate-700/60 flex items-center justify-center">
                <span className="text-[7px] text-gray-400 uppercase font-mono font-bold tracking-tight">LAZER SEN.</span>
              </div>

              {/* Laser beam */}
              <div 
                className="absolute left-1/2 top-4 -translate-x-1/2 w-[1.5px] bg-red-500/80 border-l border-red-500/40 z-10"
                style={{ 
                  height: `${Math.round((1 - (data.syrupTankCurrentVolumeMl || 0) / 50000) * 100)}%`,
                  maxHeight: 'calc(100% - 16px)'
                }}
              >
                {/* Pulsing red beam effect */}
                <div className="absolute inset-0 bg-red-400 animate-pulse" />
                
                {/* Laser terminal point indicator */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.92)] animate-ping" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.9)]" />
              </div>

              {/* Golden Syrup Liquid body */}
              <motion.div
                initial={{ height: "0%" }}
                animate={{ height: `${Math.round(((data.syrupTankCurrentVolumeMl || 0) / 50000) * 100)}%` }}
                transition={{ duration: 0.8 }}
                className="w-full bg-gradient-to-t from-amber-600/70 via-amber-500/60 to-yellow-500/45 relative"
                style={{ height: `${Math.round(((data.syrupTankCurrentVolumeMl || 0) / 50000) * 100)}%` }}
              >
                {/* Liquid sheen highlight */}
                <div className="absolute top-0 bottom-0 left-1 w-1 bg-white/10 blur-[0.2px] pointer-events-none" />
                {/* Slow rising bubbles */}
                <div className="absolute inset-0 z-0 opacity-60 overflow-hidden pointer-events-none">
                  <span className="absolute bottom-2 left-3 w-0.5 h-0.5 bg-yellow-200/40 rounded-full animate-ping [animation-duration:2.5s]" />
                  <span className="absolute bottom-8 right-3 w-0.5 h-0.5 bg-yellow-200/40 rounded-full animate-ping [animation-duration:3s]" />
                </div>
              </motion.div>
            </div>

            {/* Status / Measurements */}
            <div className="w-full grid grid-cols-1 gap-1 mt-3 pt-2 border-t border-[#2D333F]/60 text-[9px] font-mono">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-bold">KAPASİTE:</span>
                <span className="text-gray-300 font-extrabold">{data.syrupTankVolumeLiters || 50} Litre</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-bold">MEVCUT:</span>
                <span className={cn(
                  "font-extrabold",
                  data.syrupTankCurrentVolumeMl < 5000 ? "text-red-400 animate-pulse" : "text-amber-400"
                )}>
                  {((data.syrupTankCurrentVolumeMl || 0) / 1000).toFixed(2)} L
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-bold">DOLULUK:</span>
                <span className="text-gray-300 font-extrabold">
                  {(((data.syrupTankCurrentVolumeMl || 0) / 50000) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#2D333F]/30 pt-1">
                <span className="text-gray-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LAZER SENSÖR:
                </span>
                <span className="text-red-400 font-black">{data.laserSensorDistanceMm} mm</span>
              </div>
            </div>

            {/* Refill CTA */}
            {onRefillSyrup && (
              <button
                type="button"
                onClick={onRefillSyrup}
                className={cn(
                  "w-full text-center text-[9px] font-bold uppercase tracking-wider py-1.5 px-2 rounded border transition-all mt-3 flex items-center justify-center gap-1.5 active:scale-95",
                  data.syrupTankCurrentVolumeMl < 5000 
                    ? "bg-red-500/25 border-red-500 text-red-400 hover:bg-red-500/35 animate-pulse" 
                    : "bg-[#0D1016] border-[#374151] hover:border-amber-500/50 text-amber-500/95 hover:text-amber-400"
                )}
              >
                <RefreshCw size={9} className={cn(data.syrupTankCurrentVolumeMl < 5000 ? "animate-spin" : "")} /> Depoyu Doldur
              </button>
            )}

            {/* Explanatory description of volume reduction as requested */}
            <div className="bg-[#0D1016] border border-[#2D333F]/60 p-1.5 rounded text-[8px] text-gray-400 leading-normal mt-2 font-sans w-full">
              <div className="font-bold text-gray-300 mb-0.5 uppercase border-b border-[#2D333F]/40 pb-0.5">Dolum Hesabı:</div>
              {activeRecipe?.id === 'REC-SERBET' || activeRecipe?.activeValves?.length === 8 ? (
                <p className="text-emerald-400">
                  Aktif reçete ile <span className="font-bold text-white">8 valf x 40ml</span> dolumda döngü başı tam <span className="font-bold text-white">320 ml</span> şerbet kazandan eksilir.
                </p>
              ) : (
                <p>
                  Reçeteye göre <span className="font-bold text-white">{activeRecipe?.activeValves?.length || 0} valf x {activeRecipe?.volumeMl || 0}ml = {((activeRecipe?.activeValves?.length || 0) * (activeRecipe?.volumeMl || 0))} ml</span> şerbet harcanır.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Prompt Overlays */}
      <AnimatePresence>
        {data.activePrompt === "BOTTLE_CHECK" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#151921] border-2 border-blue-500 rounded-xl max-w-lg w-full p-8 shadow-[0_0_50px_rgba(59,130,246,0.3)]"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6">
                  <Droplet size={40} className="text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Dolum Alanı Kontrolü
                </h3>
                <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                  Üretim döngüsü başlamadan önce lütfen kontrol edin:
                  <br />
                  <span className="text-white font-bold">
                    Dolum alanında (şişe baskı bölgesinde) ürün var mı?
                  </span>
                </p>

                <div className="grid grid-cols-2 gap-4 w-full">
                  <button
                    onClick={() => onAnswerPrompt(true)}
                    className="bg-red-500 hover:bg-red-600 text-white py-6 rounded-lg font-bold text-xl transition-colors shadow-lg flex flex-col items-center gap-2 active:scale-95"
                  >
                    <ShieldAlert size={28} />
                    EVET, VAR
                  </button>
                  <button
                    onClick={() => onAnswerPrompt(false)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white py-6 rounded-lg font-bold text-xl transition-colors shadow-lg flex flex-col items-center gap-2 active:scale-95"
                  >
                    <Target size={28} />
                    HAYIR, BOŞ
                  </button>
                </div>
                <p className="mt-6 text-gray-500 text-sm italic">
                  * Üretimin sağlıklı başlaması için alanın boş olması
                  gerekmektedir.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
