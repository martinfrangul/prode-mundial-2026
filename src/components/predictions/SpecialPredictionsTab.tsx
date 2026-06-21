"use client";

import { useState, useEffect } from "react";
import { Match, SpecialPrediction } from "@/types";
import { getSpecialPrediction, saveSpecialPrediction } from "@/lib/db";
import { motion } from "framer-motion";
import { Save, AlertCircle, Calendar, Trophy, Star, Target } from "lucide-react";

interface SpecialPredictionsTabProps {
  userId: string;
  matches: Match[];
}

// Deadline: 23 de Junio 2026, 23:59 España (UTC+2) -> 21:59 UTC
const DEADLINE = new Date("2026-06-23T21:59:00Z");

export default function SpecialPredictionsTab({ userId, matches }: SpecialPredictionsTabProps) {
  const [prediction, setPrediction] = useState<SpecialPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form states
  const [finalists, setFinalists] = useState<string[]>(["", "", "", ""]);
  const [winner, setWinner] = useState<string>("");

  const now = new Date();
  const isLocked = now > DEADLINE;

  // Extract unique teams from matches
  const uniqueTeams = Array.from(
    new Map(
      matches.flatMap(m => [
        [m.teamA.code, m.teamA],
        [m.teamB.code, m.teamB]
      ])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const data = await getSpecialPrediction(userId);
        if (data) {
          setPrediction(data);
          setFinalists([
            data.finalists[0] || "",
            data.finalists[1] || "",
            data.finalists[2] || "",
            data.finalists[3] || ""
          ]);
          setWinner(data.winner || "");
        }
      } catch (err) {
        console.error("Error loading special predictions", err);
        setError("Error al cargar tus predicciones especiales.");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [userId]);

  const handleFinalistChange = (index: number, value: string) => {
    const newFinalists = [...finalists];
    newFinalists[index] = value;
    setFinalists(newFinalists);
  };

  const handleSave = async () => {
    if (isLocked) return;
    
    // Validations
    if (finalists.some(f => !f)) {
      setError("Debes seleccionar los 4 semifinalistas.");
      return;
    }
    const uniqueSelected = new Set(finalists.filter(f => f));
    if (uniqueSelected.size !== 4) {
      setError("No puedes repetir equipos en los semifinalistas.");
      return;
    }
    if (!winner) {
      setError("Debes seleccionar un campeón.");
      return;
    }
    if (!finalists.includes(winner)) {
      setError("El campeón debe estar entre los 4 semifinalistas.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await saveSpecialPrediction(userId, finalists, winner);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving special predictions", err);
      setError("Ocurrió un error al guardar. Inténtalo nuevamente.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Apuestas Especiales</h2>
        <p className="text-foreground/70 text-sm">
          Suma puntos extra pronosticando a los mejores del torneo.
        </p>
      </div>

      {isLocked && (
        <div className="glass p-4 rounded-2xl border-red-500/30 bg-red-500/5 text-red-400 flex items-start gap-3">
          <Calendar className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Apuestas Cerradas</h4>
            <p className="text-xs opacity-90 mt-1">La fecha límite (23 de Junio) ha pasado. Ya no puedes modificar tus apuestas especiales.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-sm flex items-center gap-2"
        >
          <Star className="w-4 h-4 flex-shrink-0" />
          Apuestas guardadas correctamente.
        </motion.div>
      )}

      <div className="space-y-8">
        {/* Semifinalists */}
        <div className="glass p-5 sm:p-6 rounded-3xl border border-card-border/60">
          <div className="flex items-center gap-3 mb-4 border-b border-card-border/50 pb-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Target className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Los 4 Semifinalistas</h3>
              <p className="text-xs text-foreground/50">Puntos: 4 aciertos = 10 pts | 3 = 8 pts | 2 = 5 pts | 1 = 3 pts</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-foreground/50 ml-1">
                  Semifinalista {index + 1}
                </label>
                <select
                  value={finalists[index]}
                  onChange={(e) => handleFinalistChange(index, e.target.value)}
                  disabled={isLocked}
                  className="w-full bg-background border border-card-border/85 rounded-xl px-3 py-2.5 text-sm text-foreground font-semibold focus:outline-none focus:border-gold transition-all disabled:opacity-50"
                >
                  <option value="">Selecciona un equipo</option>
                  {uniqueTeams.map((team) => (
                    <option key={team.code} value={team.code}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Winner */}
        <div className="glass p-5 sm:p-6 rounded-3xl border border-card-border/60">
          <div className="flex items-center gap-3 mb-4 border-b border-card-border/50 pb-3">
            <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-gold" />
            </div>
            <div>
              <h3 className="font-bold text-lg">El Campeón</h3>
              <p className="text-xs text-foreground/50">15 puntos si aciertas</p>
            </div>
          </div>
          
          <div className="space-y-1">
            <select
              value={winner}
              onChange={(e) => setWinner(e.target.value)}
              disabled={isLocked}
              className="w-full bg-background border border-card-border/85 rounded-xl px-3 py-3 text-sm text-foreground font-bold focus:outline-none focus:border-gold transition-all disabled:opacity-50"
            >
              <option value="">Selecciona al ganador del mundial</option>
              {finalists.some(f => f) 
                ? uniqueTeams.filter(t => finalists.includes(t.code)).map((team) => (
                    <option key={team.code} value={team.code}>
                      {team.name}
                    </option>
                  ))
                : uniqueTeams.map((team) => (
                    <option key={team.code} value={team.code}>
                      {team.name}
                    </option>
                  ))
              }
            </select>
            {finalists.some(f => f) && (
              <p className="text-[10px] text-foreground/40 ml-1 mt-1">
                Nota: El campeón debe estar entre los semifinalistas elegidos.
              </p>
            )}
          </div>
        </div>


        {!isLocked && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-gold hover:bg-yellow-600 disabled:bg-foreground/10 disabled:text-foreground/40 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-gold/20"
          >
            {isSaving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Guardar Apuestas Especiales
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
