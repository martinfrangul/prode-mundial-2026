import { Match, Prediction } from "@/types";
import { useState } from "react";
import { savePrediction } from "@/lib/db";
import { Check } from "lucide-react";

interface MatchCardProps {
  match: Match;
  prediction?: Prediction;
  userId: string;
  onPredictionSaved?: (updatedPrediction: Prediction) => void;
}

export default function MatchCard({ match, prediction, userId, onPredictionSaved }: MatchCardProps) {
  const [scoreA, setScoreA] = useState<number | "">(prediction?.predictedScoreA ?? "");
  const [scoreB, setScoreB] = useState<number | "">(prediction?.predictedScoreB ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isLocked = new Date() > new Date(match.kickoffTime) || match.status !== "scheduled";

  const handleSave = async () => {
    if (scoreA === "" || scoreB === "") return;
    setIsSaving(true);
    try {
      await savePrediction(userId, match.id, Number(scoreA), Number(scoreB));
      setSaved(true);
      if (onPredictionSaved) {
        onPredictionSaved({
          id: `${userId}_${match.id}`,
          userId,
          matchId: match.id,
          predictedScoreA: Number(scoreA),
          predictedScoreB: Number(scoreB),
          pointsEarned: prediction?.pointsEarned ?? null
        });
      }
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Error saving prediction", error);
    } finally {
      setIsSaving(false);
    }
  };

  const formattedDate = new Date(match.kickoffTime).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });

  const getPointsBadgeClass = (points: number) => {
    if (points === 3) return "bg-amber-500/20 text-amber-600 border border-amber-500/30";
    if (points === 1) return "bg-yellow-500/20 text-yellow-600 border border-yellow-500/30";
    return "bg-foreground/10 text-foreground/60 border border-card-border";
  };

  const getPointsLabel = (points: number) => {
    if (points === 3) return "Exacto (+3 pts)";
    if (points === 1) return "Acierto (+1 pt)";
    return "Errado (0 pts)";
  };

  return (
    <div className={`glass rounded-3xl p-5 flex flex-col gap-4 relative overflow-hidden transition-all duration-300 border ${
      isLocked 
        ? "bg-card/25 border-card-border/60 hover:shadow-inner" 
        : "hover:border-gold/30 hover:shadow-md hover:shadow-gold/5"
    }`}>
      {/* Top Header Row */}
      <div className="flex justify-between items-center text-xs font-semibold text-foreground/50">
        <span>{match.stage === "group" ? `Grupo ${match.group}` : "Playoff"}</span>
        <div className="flex items-center gap-2">
          <span>{formattedDate}</span>
          {isLocked && (
            <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-extrabold tracking-wider ${
              match.status === "finished" 
                ? "bg-foreground/10 text-foreground/60" 
                : match.status === "in_play" 
                ? "bg-green-500/20 text-green-600 animate-pulse border border-green-500/30" 
                : "bg-red-500/10 text-red-500 border border-red-500/20"
            }`}>
              {match.status === "finished" ? "Finalizado" : match.status === "in_play" ? "En Vivo" : "Cerrado"}
            </span>
          )}
        </div>
      </div>

      {/* Middle: Teams Content */}
      <div className="flex flex-col gap-3">
        {/* Team A Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-foreground/5 flex items-center justify-center text-sm shadow-inner overflow-hidden border border-card-border/50">
              {match.teamA.flagUrl ? (
                <img src={match.teamA.flagUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold text-[10px] text-foreground/60">{match.teamA.code}</span>
              )}
            </div>
            <span className={`font-semibold text-sm ${isLocked ? "text-foreground/80" : "text-foreground"}`}>
              {match.teamA.name}
            </span>
          </div>

          {isLocked ? (
            <div className="w-10 h-10 flex items-center justify-center bg-foreground/5 border border-card-border/60 rounded-xl font-bold text-base text-foreground/90 select-none">
              {match.actualScoreA ?? "-"}
            </div>
          ) : (
            <input
              type="number"
              min="0"
              max="15"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value === "" ? "" : Number(e.target.value))}
              onKeyDown={(e) => {
                if (["e", "E", "+", "-", ".", ","].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              className="w-12 h-10 bg-background border border-card-border rounded-xl text-center font-bold text-base focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
            />
          )}
        </div>

        {/* Team B Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-foreground/5 flex items-center justify-center text-sm shadow-inner overflow-hidden border border-card-border/50">
              {match.teamB.flagUrl ? (
                <img src={match.teamB.flagUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold text-[10px] text-foreground/60">{match.teamB.code}</span>
              )}
            </div>
            <span className={`font-semibold text-sm ${isLocked ? "text-foreground/80" : "text-foreground"}`}>
              {match.teamB.name}
            </span>
          </div>

          {isLocked ? (
            <div className="w-10 h-10 flex items-center justify-center bg-foreground/5 border border-card-border/60 rounded-xl font-bold text-base text-foreground/90 select-none">
              {match.actualScoreB ?? "-"}
            </div>
          ) : (
            <input
              type="number"
              min="0"
              max="15"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value === "" ? "" : Number(e.target.value))}
              onKeyDown={(e) => {
                if (["e", "E", "+", "-", ".", ","].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              className="w-12 h-10 bg-background border border-card-border rounded-xl text-center font-bold text-base focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
            />
          )}
        </div>
      </div>

      {/* Bottom: Action/Prediction summary */}
      {isLocked ? (
        <div className="mt-1 pt-3 border-t border-card-border/40 flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">Tu Pronóstico</span>
            <span className="text-sm font-extrabold text-foreground/75">
              {prediction && prediction.predictedScoreA !== null && prediction.predictedScoreB !== null ? (
                `${prediction.predictedScoreA} - ${prediction.predictedScoreB}`
              ) : (
                <span className="text-red-400 font-semibold text-xs italic">Sin pronóstico</span>
              )}
            </span>
          </div>

          {match.status === "finished" && prediction && prediction.pointsEarned !== null && (
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${getPointsBadgeClass(prediction.pointsEarned)}`}>
              {getPointsLabel(prediction.pointsEarned)}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={handleSave}
          disabled={isSaving || scoreA === "" || scoreB === ""}
          className={`w-full mt-1 py-2.5 rounded-xl transition-all text-sm font-bold flex items-center justify-center gap-2 cursor-pointer
            ${saved 
              ? "bg-green-500/20 text-green-600 border border-green-500/30" 
              : "bg-gold text-white hover:bg-yellow-600 disabled:opacity-50 disabled:bg-foreground/10 disabled:text-foreground/50"
            }`}
        >
          {saved ? (
            <>
              <Check className="w-4 h-4" /> Guardado
            </>
          ) : isSaving ? (
            "Guardando..."
          ) : (
            "Guardar Predicción"
          )}
        </button>
      )}
    </div>
  );
}
