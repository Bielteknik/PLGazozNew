import React, { useState } from "react";
import {
  SlidersHorizontal,
  Settings,
  Activity,
  Hammer,
  Lock,
  Unlock,
  Zap,
  AlertTriangle,
  ShieldCheck,
  Database,
  RotateCcw,
  Play,
  CheckCircle,
  Droplet,
  Plus,
  Eye,
  Key,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { SystemData, Recipe } from "../../types/system";

interface OperatorPanelProps {
  data: SystemData;
  onResetCounter: (type: "input" | "output") => void;
  onSelectRecipe: (recipeId: string) => void;
  onAdjustCounter: (type: "input" | "output", count: number) => void;
  toggleValve: (valveId: number) => void;
  onUpdateValve: (id: number, updates: Partial<any>) => void;
  operateGate: (gateKey: "inputGate" | "outputGate", position: number) => void;
}

export function OperatorPanel({
  data,
  onResetCounter,
  onSelectRecipe,
  onAdjustCounter,
  toggleValve,
  onUpdateValve,
  operateGate,
}: OperatorPanelProps) {
  const [isFilling, setIsFilling] = useState(false);

  const activeRecipe = data.recipes.find((r) => r.id === data.config.recipeId);

  const progressRatio = activeRecipe
    ? data.outputCount / activeRecipe.targetCount
    : 0;
  const isApproachingLimit = progressRatio >= 0.9 && progressRatio < 1.0;
  const isLimitReached = progressRatio >= 1.0;

  const handleManualBottleInput = () => {
    onAdjustCounter("input", 1);
  };

  const handleManualBottleExit = () => {
    onAdjustCounter("output", 1);
  };

  const handleRecipeAutoFill = () => {
    if (!activeRecipe || isFilling) return;
    setIsFilling(true);

    // Open the input gate to simulate bottle coming in
    operateGate("inputGate", 100);

    setTimeout(() => {
      // Increment input count
      onAdjustCounter("input", 1);
      operateGate("inputGate", 0); // Close input gate

      // Trigger all valves defined in recipe
      const valvesToOpen = activeRecipe.activeValves || [
        1, 2, 3, 4, 5, 6, 7, 8,
      ];
      
      let longestValveTime = 0;

      valvesToOpen.forEach((valveId) => {
        const duration = activeRecipe.valveDurations?.[valveId] ?? activeRecipe.fillTimeMs ?? 1500;
        if (duration > longestValveTime) {
          longestValveTime = duration;
        }

        // Open specific valve properly
        onUpdateValve(valveId, { isOpen: true });

        // Close after its specific duration has elapsed
        setTimeout(() => {
          onUpdateValve(valveId, { isOpen: false });
        }, duration);
      });

      if (longestValveTime === 0) {
        longestValveTime = activeRecipe.fillTimeMs || 1500;
      }

      setTimeout(() => {
        setTimeout(() => {
          // Open output gate for bottle exit
          operateGate("outputGate", 100);

          setTimeout(() => {
            onAdjustCounter("output", 1);
            operateGate("outputGate", 0); // Close gate
            setIsFilling(false);
          }, 800);
        }, activeRecipe.settlingTimeMs || 800);
      }, longestValveTime);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gradient-to-r from-[#111827] to-[#1F2937] border border-blue-500/30 p-4 rounded shrink-0 shadow-lg gap-4 md:gap-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 animate-pulse">
            <SlidersHorizontal size={22} />
          </div>
          <div>
            <h2 className="text-sm font-black text-white tracking-wider flex items-center gap-2">
              OPERATÖR PANELİ
            </h2>
            <p className="text-[10px] text-gray-400 mt-1 font-bold uppercase tracking-wider">
              REÇETE DESTEKLİ KOORDİNASYON VE SERBEST ÜRETİM MERKEZİ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] uppercase font-bold bg-[#0D1016] px-3 py-1.5 rounded border border-[#2D333F]">
          <span className="text-gray-500">Saha Modu:</span>
          <span className="text-orange-400 font-mono font-black">
            {data.mode}
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] leading-none" />
          <span className="text-emerald-500">Operatör Aktif</span>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto">
        <div className="h-full grid grid-cols-12 gap-4 min-h-0 overflow-y-auto">
          {/* Main Visualizer & Command Center */}
          <div className="col-span-12 bg-[#151921] border border-[#2D333F] rounded p-4 flex flex-col relative overflow-hidden shadow-2xl min-h-[520px]">
            {/* Subheader */}
            <div className="flex items-center justify-between mb-4 border-b border-[#2D333F] pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Hammer size={14} className="text-blue-400" />
                <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-none">
                  Operatör Canlı Panel
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 px-3 py-1 rounded text-[9px] font-black text-blue-400 uppercase tracking-wider">
                Kilitlenme Koruması Devre Dışı
              </div>
            </div>

            {/* Conveyor Splits */}
            <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-y-auto">
              {/* 1. Left controls container */}
              <div className="w-full lg:w-[380px] bg-[#0D1016]/90 border border-[#2D333F] rounded p-4 flex flex-col gap-4 overflow-y-auto shrink-0 custom-scrollbar shadow-lg">
                <div className="border-b border-gray-800 pb-2">
                  <span className="text-[10px] font-black text-orange-400 tracking-wider uppercase flex items-center gap-1.5 justify-center lg:justify-start">
                    <Database size={11} className="text-orange-400" /> REÇETE
                    parametreleri
                  </span>
                </div>

                {/* Recipe dropdown selection */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block">
                    Reçete Seçin
                  </label>
                  <select
                    value={data.config.recipeId}
                    onChange={(e) => onSelectRecipe(e.target.value)}
                    className="w-full bg-[#151921] border border-[#374151] rounded px-2.5 py-2 text-xs text-white font-extrabold outline-none focus:border-blue-500 transition-colors"
                  >
                    {data.recipes.map((recipe) => (
                      <option
                        key={recipe.id}
                        value={recipe.id}
                        className="font-bold bg-[#151921] text-white"
                      >
                        {recipe.name} ({recipe.volumeMl}ml)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Recipe Metrics readout */}
                {activeRecipe && (
                  <div className="bg-blue-950/10 border border-blue-500/10 rounded p-2.5 space-y-1.5 text-[10px] font-mono">
                    <div className="flex justify-between items-center text-gray-500">
                      <span>Sıvı Miktar:</span>
                      <span className="text-white font-black">
                        {activeRecipe.volumeMl} ml
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-gray-500">
                      <span>Tetik Süresi:</span>
                      <span className="text-blue-400 font-black">
                        {(activeRecipe.fillTimeMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-gray-500">
                      <span>Kapak Bekleme:</span>
                      <span className="text-purple-400 font-black">
                        {(activeRecipe.settlingTimeMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-gray-500">
                      <span>Hedef Adet:</span>
                      <span className="text-orange-400 font-black">
                        {activeRecipe.targetCount} Adet
                      </span>
                    </div>
                    <div className="border-t border-[#2D333F]/30 pt-1.5 flex flex-col gap-1 text-[9px]">
                      <span className="text-gray-500 uppercase tracking-wider text-[8px] font-bold">
                        Aktif Dolum Valfleri:
                      </span>
                      <div className="flex gap-1 flex-wrap mt-0.5">
                        {(
                          activeRecipe.activeValves || [
                            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
                            16,
                          ]
                        ).map((valveNum) => (
                          <span
                            key={valveNum}
                            className="text-[8.5px] bg-blue-500/10 border border-blue-500/25 px-1.5 py-0.5 text-blue-400 rounded font-black font-mono"
                          >
                            V{valveNum}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Direct production command section */}
                <div className="space-y-2 border-t border-[#1F2937] pt-3">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block">
                    Üretim Simülasyonu
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleManualBottleInput}
                      disabled={isFilling}
                      className="flex flex-col items-center justify-center p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded active:scale-95 transition-all text-center disabled:opacity-30"
                    >
                      <Plus size={14} className="mb-0.5" />
                      <span className="text-[9px] font-black uppercase tracking-wider leading-none">
                        ŞİŞE GİRİŞİ
                      </span>
                      <span className="text-[7.5px] text-gray-500 font-bold mt-1 uppercase">
                        +1 Geliş
                      </span>
                    </button>

                    <button
                      onClick={handleManualBottleExit}
                      disabled={isFilling}
                      className="flex flex-col items-center justify-center p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded active:scale-95 transition-all text-center disabled:opacity-30"
                    >
                      <Plus size={14} className="mb-0.5" />
                      <span className="text-[9px] font-black uppercase tracking-wider leading-none">
                        ŞİŞE ÇIKIŞI
                      </span>
                      <span className="text-[7.5px] text-gray-500 font-bold mt-1 uppercase">
                        +1 Sevk
                      </span>
                    </button>
                  </div>

                  <button
                    onClick={handleRecipeAutoFill}
                    disabled={isFilling}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-2.5 rounded text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95",
                      isFilling
                        ? "bg-blue-600/30 text-blue-400 border-blue-500/40 animate-pulse cursor-not-allowed"
                        : "bg-blue-600/20 text-blue-400 border-blue-500/30 hover:bg-blue-600/30",
                    )}
                  >
                    <Play
                      size={12}
                      className={isFilling ? "animate-spin" : ""}
                    />
                    {isFilling
                      ? "LİMİTLİ DOLUM YAPILIYOR..."
                      : "REÇETE DOLUMUNU TETİKLE"}
                  </button>
                </div>

                {/* Barrier manual override */}
                <div className="space-y-2 border-t border-[#1F2937] pt-3">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block">
                    Bariyer / Kilit İstasyonları
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() =>
                        operateGate(
                          "inputGate",
                          data.inputGate.isOpen ? 0 : 100,
                        )
                      }
                      className={cn(
                        "py-2 px-1 rounded text-[8px] font-black border uppercase tracking-wider transition-colors active:scale-95",
                        data.inputGate.isOpen
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-red-500/10 border-red-500/30 text-red-400",
                      )}
                    >
                      GİRİŞ: {data.inputGate.isOpen ? "AÇIK" : "KAPALI"}
                    </button>
                    <button
                      onClick={() =>
                        operateGate(
                          "outputGate",
                          data.outputGate.isOpen ? 0 : 100,
                        )
                      }
                      className={cn(
                        "py-2 px-1 rounded text-[8px] font-black border uppercase tracking-wider transition-colors active:scale-95",
                        data.outputGate.isOpen
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-red-500/10 border-red-500/30 text-red-400",
                      )}
                    >
                      ÇIKIŞ: {data.outputGate.isOpen ? "AÇIK" : "KAPALI"}
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Main Stacked Side */}
              <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto">
                {/* Recipe Limit Warning Banners */}
                <AnimatePresence mode="wait">
                  {isApproachingLimit && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-3 rounded flex items-center justify-between gap-3 shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-pulse shrink-0"
                      id="recipe-warning-approaching"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle
                          size={16}
                          className="text-amber-400 shrink-0"
                        />
                        <div className="text-[10px] font-bold leading-tight uppercase tracking-wider text-left">
                          <span className="font-extrabold text-white">
                            REÇETE HEDEF LİMİTİNE YAKLAŞILDI:
                          </span>{" "}
                          <span className="text-amber-300">
                            "{activeRecipe?.name}"
                          </span>{" "}
                          üretimi{" "}
                          <span className="text-white font-mono">
                            {data.outputCount}/{activeRecipe?.targetCount}
                          </span>{" "}
                          (%{(progressRatio * 100).toFixed(0)}) seviyesindedir!
                        </div>
                      </div>
                      <div className="text-[8px] bg-amber-500/20 px-2.5 py-1 rounded font-black text-amber-300 uppercase shrink-0 tracking-wider">
                        LİMİT UYARISI (%90+)
                      </div>
                    </motion.div>
                  )}

                  {isLimitReached && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 p-3 rounded flex items-center justify-between gap-3 shadow-[0_0_15px_rgba(16,185,129,0.2)] shrink-0"
                      id="recipe-warning-reached"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle
                          size={16}
                          className="text-emerald-400 shrink-0"
                        />
                        <div className="text-[10px] font-bold leading-tight uppercase tracking-wider text-left">
                          <span className="font-extrabold text-white font-black">
                            HEDEF LİMİTE ULAŞILDI:
                          </span>{" "}
                          <span className="text-emerald-300">
                            "{activeRecipe?.name}"
                          </span>{" "}
                          üretimi başarıyla{" "}
                          <span className="text-white font-mono">
                            {data.outputCount}/{activeRecipe?.targetCount}
                          </span>{" "}
                          hedefine ulaştı.
                        </div>
                      </div>
                      <div className="text-[8px] bg-emerald-500/20 px-2.5 py-1 rounded font-black text-emerald-300 uppercase shrink-0 tracking-wider animate-bounce">
                        LİMİT DOLDU
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Interactive conveyor graphic */}
                <div className="flex-1 flex flex-col justify-between items-center relative w-full pt-4 pl-0 lg:pl-2 bg-black/30 rounded border border-[#2D333F]/40 p-4 min-h-[380px]">
                  {/* Sensors list */}
                  <div className="w-full flex justify-between px-8 mb-6 z-20">
                    {/* Entrada Sensor */}
                    <div
                      className={cn(
                        "flex gap-3 px-4 py-2 bg-[#0D1016]/90 border rounded shadow-md items-center transition-all select-none group",
                        data.sensors.find((s) => s.id === "SENS-IN")?.enabled
                          ? "border-blue-500 bg-blue-950/10 shadow-[0_0_10px_rgba(59,130,246,0.25)]"
                          : "border-[#2D333F] hover:border-gray-700",
                      )}
                    >
                      <div
                        className={cn(
                          "w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all",
                          data.sensors.find((s) => s.id === "SENS-IN")?.enabled
                            ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                            : "bg-gray-800",
                        )}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />
                      </div>
                      <div className="text-left">
                        <div className="text-[8px] text-gray-500 mb-0.5 font-bold tracking-wider group-hover:text-gray-300 transition-colors uppercase">
                          GİRİŞ LAZER (NANO 2)
                        </div>
                        <div className="text-xl font-mono text-white leading-none font-extrabold">
                          {data.inputCount}
                        </div>
                      </div>
                    </div>

                    {/* Bottling Valve zone indicator */}
                    <div className="flex flex-col items-center justify-center select-none">
                      <div className="text-[8px] text-gray-400 font-extrabold tracking-widest uppercase mb-1 flex items-center gap-1.5">
                        <Activity
                          size={10}
                          className="text-blue-500 animate-pulse"
                        />
                        <span className="animate-pulse">
                          AKTİF REÇETE İSTASYONU
                        </span>
                      </div>
                      <div className="text-[10px] text-white font-black bg-blue-500/15 border border-blue-500/30 px-3 py-1 rounded uppercase tracking-wider shadow-inner">
                        {activeRecipe?.name || "REÇETE YOK"}
                      </div>
                    </div>

                    {/* Sevk Photoeye Sensor */}
                    <div
                      className={cn(
                        "flex gap-3 px-4 py-2 bg-[#0D1016]/90 border rounded shadow-md items-center transition-all select-none group",
                        data.sensors.find((s) => s.id === "SENS-OUT")?.enabled
                          ? "border-emerald-500 bg-emerald-950/10 shadow-[0_0_10px_rgba(16,185,129,0.25)]"
                          : "border-[#2D333F] hover:border-gray-700",
                      )}
                    >
                      <div
                        className={cn(
                          "w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all",
                          data.sensors.find((s) => s.id === "SENS-OUT")?.enabled
                            ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                            : "bg-gray-800",
                        )}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />
                      </div>
                      <div className="text-right">
                        <div className="text-[8px] text-gray-400 mb-0.5 font-bold tracking-wider group-hover:text-gray-300 transition-colors uppercase">
                          ÇIKIŞ LAZER (NANO 2)
                        </div>
                        <div className="text-xl font-mono text-white leading-none font-extrabold">
                          {data.outputCount}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive conveyor belt drawing */}
                  <div className="w-full h-44 border-y-4 border-[#374151] bg-[#0D1016]/50 flex items-center justify-between px-16 relative mt-6 mb-24 shadow-2xl">
                    {/* Bottles mapping - Retro Glass Bottles */}
                    <div
                      className={cn(
                        "absolute left-20 right-20 bottom-0 flex justify-between px-2 z-0",
                      )}
                    >
                      {(() => {
                        const activeValves = activeRecipe?.activeValves || [1, 2, 3, 4, 5, 6, 7, 8];
                        const sortedActiveValves = [...activeValves].sort((a, b) => a - b);
                        
                        return [...data.valves].reverse().map((valve) => {
                          const rank = sortedActiveValves.indexOf(valve.id);
                          const isLargeLine = data.valves.length > 8;
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

                          if (!hasBottle) {
                            return (
                              <div
                                key={"bottle-" + valve.id}
                                className={cn(
                                  "flex justify-center transition-all duration-300",
                                  isLargeLine ? "w-5 sm:w-8" : "w-12",
                                )}
                              >
                                <div
                                  className={cn(
                                    isLargeLine ? "h-14" : "h-20",
                                  )}
                                />
                              </div>
                            );
                          }

                          // If valve is currently open (filling) or if in wash/cleaning
                          const isFillingNow =
                            valve.isOpen ||
                            (data.mode === "YIKAMA" && valve.enabled);

                          // Bottle is filled if it has been through the cycle
                          const isFilled =
                            data.mode === "OTOMATİK"
                              ? [
                                  "DAMLA_BEKLEME",
                                  "TAHLIYE",
                                  "DOGRULAMA",
                                ].includes(data.autoState)
                              : data.outputCount > 0 ||
                                isFillingNow ||
                                rank < data.outputCount;

                          return (
                            <div
                              key={"bottle-" + valve.id}
                              className={cn(
                                "flex justify-center transition-all duration-300",
                                isLargeLine ? "w-5 sm:w-8" : "w-12",
                              )}
                            >
                              <motion.div
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 15 }}
                                className={cn(
                                  "relative flex flex-col items-center select-none transition-all duration-300",
                                  isLargeLine ? "w-5 h-14" : "w-10 h-20",
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
                                    isLargeLine ? "w-1.5 h-1.5" : "w-2.5 h-3",
                                  )}
                                />

                                {/* Upper body shoulder slope */}
                                <div
                                  className={cn(
                                    "bg-gradient-to-b from-emerald-500/10 to-emerald-700/15 border-x border-teal-400/30 relative z-10",
                                    isLargeLine
                                      ? "w-2.5 h-1 ml-[-2px] mr-[-2px] border-t rounded-t"
                                      : "w-6 h-1.5 ml-[-4px] mr-[-4px] border-t rounded-t-md",
                                  )}
                                />

                                {/* Main Glass Body */}
                                <div
                                  className={cn(
                                    "bg-gradient-to-b from-emerald-400/10 to-teal-800/15 rounded-t-md rounded-b border-x border-b border-teal-400/30 shadow-md relative overflow-hidden flex flex-col items-center justify-start",
                                    isLargeLine
                                      ? "w-5 h-8 -mt-[1px]"
                                      : "w-9 h-12 -mt-[1px]",
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
                                    transition={{
                                      duration: 1,
                                      ease: "easeInOut",
                                    }}
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
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Physical Entrada Gate */}
                    <div className="absolute left-6 -bottom-20 flex flex-col items-center z-20">
                      <button
                        onClick={() =>
                          operateGate(
                            "inputGate",
                            data.inputGate.isOpen ? 0 : 100,
                          )
                        }
                        className="h-36 w-6 flex items-end overflow-hidden group cursor-pointer"
                      >
                        <motion.div
                          initial={false}
                          animate={{ y: data.inputGate.isOpen ? "100%" : "0%" }}
                          transition={{
                            type: "spring",
                            bounce: 0,
                            duration: 0.3,
                          }}
                          className={cn(
                            "w-full h-24 rounded-t transition-all border-x-2 border-t-2",
                            data.inputGate.isOpen
                              ? "bg-emerald-500/20 border-emerald-500/30 group-hover:bg-emerald-500/10"
                              : "bg-red-600 border-red-800 group-hover:bg-red-500 shadow-xl",
                          )}
                        />
                      </button>
                      <div
                        onClick={() =>
                          operateGate(
                            "inputGate",
                            data.inputGate.isOpen ? 0 : 100,
                          )
                        }
                        className="w-16 h-11 bg-[#1C2029] border border-[#3E4C59] rounded-b-md flex flex-col items-center justify-center z-10 shadow-lg relative -top-1.5 cursor-pointer hover:bg-[#2D333F] transition-colors group"
                      >
                        <div className="absolute -top-3.5 bg-[#151921] rounded-full p-1 z-20 flex items-center justify-center h-6 w-6 shadow-md border border-blue-500/40">
                          {data.inputGate.isOpen ? (
                            <Unlock size={12} className="text-emerald-500" />
                          ) : (
                            <Lock size={12} className="text-red-500" />
                          )}
                        </div>
                        <div
                          className={cn(
                            "w-6 h-1 rounded-full mb-0.5",
                            data.inputGate.isOpen
                              ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]"
                              : "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]",
                          )}
                        />
                        <div className="text-[8px] text-white font-black tracking-wider mt-0.5 group-hover:text-blue-400 text-center uppercase leading-tight">
                          GİRİŞ SELENOİD<br />KİLİT (NANO 2)
                        </div>
                      </div>
                    </div>

                    {/* Direct Valves override triggers on the line */}
                    <div
                      className={cn(
                        "absolute left-20 right-20 top-2 flex justify-between px-2 -mt-1 z-10",
                      )}
                    >
                      {[...data.valves].reverse().map((valve) => (
                        <div
                          key={valve.id}
                          className={cn(
                            "flex flex-col items-center",
                            data.valves.length > 8 ? "w-5 sm:w-8" : "w-12",
                          )}
                        >
                          <button
                            onClick={() => toggleValve(valve.id)}
                            className={cn(
                              "rounded-lg shadow-lg border transition-all flex items-center justify-center active:scale-95 relative",
                              data.valves.length > 8
                                ? "w-5 h-5 sm:w-8 sm:h-8 border-cyan-800/40"
                                : "w-10 h-10 border-2",
                              valve.isOpen
                                ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)] animate-pulse"
                                : "bg-[#2D333F] border-[#1F2937] text-gray-400 hover:border-gray-500 hover:text-white",
                            )}
                          >
                            <Droplet size={data.valves.length > 8 ? 10 : 15} />
                            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 px-0.5 rounded text-[5.5px] sm:text-[7px] font-bold text-gray-400 font-mono">
                              D{valve.id}
                            </span>
                          </button>
                          <div
                            className={cn(
                              "bg-[#1F2937] mt-1 rounded-b-sm relative z-20 border-x border-gray-700",
                              data.valves.length > 8
                                ? "w-1.5 h-2.5 sm:w-2.5 sm:h-4"
                                : "w-2.5 h-4",
                            )}
                          />
                          <AnimatePresence>
                            {valve.isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 1 }}
                                animate={{
                                  height: data.valves.length > 8 ? 35 : 50,
                                  opacity: 0,
                                }}
                                transition={{
                                  repeat: Infinity,
                                  duration: 0.45,
                                }}
                                className="w-1.5 mt-0.5 absolute top-[30px] sm:top-[55px] rounded-full z-10 bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)]"
                              />
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>

                    {/* Physical Sevk Gate */}
                    <div className="absolute right-6 -bottom-20 flex flex-col items-center z-20">
                      <button
                        onClick={() =>
                          operateGate(
                            "outputGate",
                            data.outputGate.isOpen ? 0 : 100,
                          )
                        }
                        className="h-36 w-6 flex items-end overflow-hidden group cursor-pointer"
                      >
                        <motion.div
                          initial={false}
                          animate={{
                            y: data.outputGate.isOpen ? "100%" : "0%",
                          }}
                          transition={{
                            type: "spring",
                            bounce: 0,
                            duration: 0.3,
                          }}
                          className={cn(
                            "w-full h-24 rounded-t transition-all border-x-2 border-t-2",
                            data.outputGate.isOpen
                              ? "bg-emerald-500/20 border-emerald-500/30 group-hover:bg-emerald-500/10"
                              : "bg-red-600 border-red-800 group-hover:bg-red-500 shadow-xl",
                          )}
                        />
                      </button>
                      <div
                        onClick={() =>
                          operateGate(
                            "outputGate",
                            data.outputGate.isOpen ? 0 : 100,
                          )
                        }
                        className="w-16 h-11 bg-[#1C2029] border border-[#3E4C59] rounded-b-md flex flex-col items-center justify-center z-10 shadow-lg relative -top-1.5 cursor-pointer hover:bg-[#2D333F] transition-colors group"
                      >
                        <div className="absolute -top-3.5 bg-[#151921] rounded-full p-1 z-20 flex items-center justify-center h-6 w-6 shadow-md border border-blue-500/40">
                          {data.outputGate.isOpen ? (
                            <Unlock size={12} className="text-emerald-500" />
                          ) : (
                            <Lock size={12} className="text-red-500" />
                          )}
                        </div>
                        <div
                          className={cn(
                            "w-6 h-1 rounded-full mb-0.5",
                            data.outputGate.isOpen
                              ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]"
                              : "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]",
                          )}
                        />
                        <div className="text-[8px] text-white font-black tracking-wider mt-0.5 group-hover:text-blue-400 text-center uppercase leading-tight">
                          ÇIKIŞ SELENOİD<br />KİLİT (NANO 2)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
