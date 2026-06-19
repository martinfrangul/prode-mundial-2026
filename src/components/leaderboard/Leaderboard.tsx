"use client";

import { useEffect, useState } from "react";
import { UserProfile } from "@/types";
import { getUserLeaderboard } from "@/lib/db";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Award, Users, RefreshCw } from "lucide-react";

interface LeaderboardProps {
  currentUserId?: string;
}

export default function Leaderboard({ currentUserId }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUserLeaderboard();
      setLeaderboard(data);
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
                    className={`flex items-center justify-between p-4 transition-all duration-300 ${
                      isCurrentUser 
                        ? "bg-gold/10 border border-gold/30 rounded-2xl my-1 relative shadow-sm shadow-gold/5" 
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank badge */}
                      <div className="flex justify-center w-8">
                        {getRankBadge(rank)}
                      </div>

                      {/* Avatar */}
                      <div className="relative">
                        <img
                          src={profile.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${profile.displayName}`}
                          alt={profile.displayName}
                          className="w-10 h-10 rounded-full border border-card-border object-cover bg-background"
                        />
                        {isCurrentUser && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                        )}
                      </div>

                      {/* Name */}
                      <div>
                        <span className={`font-semibold text-sm ${isCurrentUser ? "text-gold font-bold" : "text-foreground"}`}>
                          {profile.displayName}
                        </span>
                        {isCurrentUser && (
                          <span className="ml-2 text-[10px] bg-gold/20 text-gold border border-gold/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Tú
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <span className="text-lg font-bold text-foreground">
                        {profile.totalScore}
                      </span>
                      <span className="text-[10px] text-foreground/50 block font-medium uppercase tracking-wider">
                        Puntos
                      </span>
                    </div>
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
