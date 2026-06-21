"use client";

import { useEffect, useState } from "react";
import { Match, SpecialPrediction, UserProfile } from "@/types";
import { getUserLeaderboard, getAllSpecialPredictions } from "@/lib/db";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Award, Users, RefreshCw, ChevronDown, ChevronUp, Lock, Star, Target } from "lucide-react";

interface LeaderboardProps {
  currentUserId?: string;
  matches?: Match[];
}

const DEADLINE = new Date("2026-06-23T21:59:00Z");

export default function Leaderboard({ currentUserId, matches = [] }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [specialPredictions, setSpecialPredictions] = useState<Record<string, SpecialPrediction>>({});
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [data, specialData] = await Promise.all([
        getUserLeaderboard(),
        getAllSpecialPredictions()
      ]);
      setLeaderboard(data);
      
      const specialMap: Record<string, SpecialPrediction> = {};
      specialData.forEach(sp => { specialMap[sp.userId] = sp; });
      setSpecialPredictions(specialMap);
    } catch (err: any) {
      console.error("Error fetching leaderboard:", err);
      setError("No se pudo cargar la tabla de clasificación. Asegúrate de configurar Firestore.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/50 shadow-sm shadow-amber-500/10">
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
        );
      case 2:
        return (
          <div className="w-8 h-8 rounded-full bg-slate-300/20 flex items-center justify-center border border-slate-300/50 shadow-sm shadow-slate-300/10">
            <Award className="w-4 h-4 text-slate-300" />
          </div>
        );
      case 3:
        return (
          <div className="w-8 h-8 rounded-full bg-amber-700/20 flex items-center justify-center border border-amber-700/50 shadow-sm shadow-amber-700/10">
            <Award className="w-4 h-4 text-amber-700" />
          </div>
        );
      default:
        return (
          <span className="w-8 text-center text-sm font-medium text-foreground/50">
            #{rank}
          </span>
        );
    }
  };

  const toggleExpand = (uid: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const getTeamName = (code: string) => {
    for (const m of matches) {
      if (m.teamA.code === code) return m.teamA.name;
      if (m.teamB.code === code) return m.teamB.name;
    }
    return code;
  };

  const now = new Date();
  const isLocked = now <= DEADLINE;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gold" />
          <span className="text-sm font-medium text-foreground/60">
            {leaderboard.length} {leaderboard.length === 1 ? "usuario participando" : "usuarios participando"}
          </span>
        </div>
        <button
          onClick={fetchLeaderboard}
          disabled={isLoading}
          className="p-2 rounded-xl hover:bg-foreground/5 transition-colors text-foreground/70 disabled:opacity-50"
          title="Actualizar tabla"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass p-4 rounded-2xl flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-foreground/10" />
                <div className="w-10 h-10 rounded-full bg-foreground/10" />
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-foreground/10 rounded" />
                </div>
              </div>
              <div className="h-6 w-12 bg-foreground/10 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="glass p-6 rounded-2xl text-center text-red-400 border border-red-500/20">
          <p>{error}</p>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="glass p-12 rounded-2xl text-center text-foreground/50">
          Aún no hay usuarios en la tabla de clasificación.
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-3xl p-2 border border-card-border">
          <div className="divide-y divide-card-border/50">
            <AnimatePresence mode="popLayout">
              {leaderboard.map((profile, index) => {
                const rank = index + 1;
                const isCurrentUser = profile.uid === currentUserId;

                return (
                  <motion.div
                    key={profile.uid}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ type: "spring", stiffness: 200, damping: 25 }}
                    className={`flex flex-col p-4 transition-all duration-300 ${
                      isCurrentUser 
                        ? "bg-gold/10 border border-gold/30 rounded-2xl my-1 relative shadow-sm shadow-gold/5" 
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        {/* Rank badge */}
                        <div className="flex justify-center w-6 sm:w-8 flex-shrink-0">
                          {getRankBadge(rank)}
                        </div>

                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <img
                            src={profile.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${profile.displayName}`}
                            alt={profile.displayName}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-card-border object-cover bg-background"
                          />
                          {isCurrentUser && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />
                          )}
                        </div>

                        {/* Name */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span className={`font-semibold text-xs sm:text-sm truncate block max-w-[110px] sm:max-w-[200px] ${isCurrentUser ? "text-gold font-bold" : "text-foreground"}`}>
                              {profile.displayName}
                            </span>
                            {isCurrentUser && (
                              <span className="text-[9px] bg-gold/20 text-gold border border-gold/30 px-1.5 py-0.25 rounded-full font-bold uppercase tracking-wider">
                                Tú
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-right flex-shrink-0 flex items-center">
                        <span className="text-base sm:text-lg font-bold text-foreground">
                          {profile.totalScore}
                        </span>
                        {/* Expand Button */}
                        <button 
                          onClick={() => toggleExpand(profile.uid)}
                          className="ml-2 sm:ml-4 p-1.5 rounded-full hover:bg-foreground/5 text-foreground/50 transition-colors"
                        >
                          {expandedUsers.has(profile.uid) ? (
                            <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : (
                            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Special Predictions */}
                    <AnimatePresence>
                      {expandedUsers.has(profile.uid) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-t border-card-border/30 mt-4 pt-4 w-full"
                        >
                          <h4 className="text-xs font-bold text-foreground/70 uppercase tracking-wider mb-3">Apuestas Especiales</h4>
                          
                          {isLocked && !isCurrentUser ? (
                            <div className="flex items-center gap-2 text-foreground/50 text-xs sm:text-sm bg-background p-3 rounded-xl border border-card-border/50">
                              <Lock className="w-4 h-4 text-amber-500/70" />
                              <span>Ocultas hasta el 23 de Junio</span>
                            </div>
                          ) : !specialPredictions[profile.uid] ? (
                            <div className="text-foreground/50 text-xs sm:text-sm bg-background p-3 rounded-xl border border-card-border/50">
                              No apostado
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="bg-background p-3 rounded-xl border border-card-border/50">
                                <div className="flex items-center gap-1.5 mb-1.5 text-blue-500/80">
                                  <Target className="w-3.5 h-3.5" />
                                  <span className="text-[10px] uppercase font-bold">Semifinalistas</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {specialPredictions[profile.uid].finalists.filter(f => f).map((code, i) => (
                                    <span key={i} className="text-xs font-semibold bg-foreground/5 px-2 py-0.5 rounded-md">
                                      {getTeamName(code)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="bg-background p-3 rounded-xl border border-card-border/50">
                                <div className="flex items-center gap-1.5 mb-1.5 text-gold/80">
                                  <Trophy className="w-3.5 h-3.5" />
                                  <span className="text-[10px] uppercase font-bold">Campeón</span>
                                </div>
                                <div className="text-xs font-semibold">
                                  {getTeamName(specialPredictions[profile.uid].winner)}
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
