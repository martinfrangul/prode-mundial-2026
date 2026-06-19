"use client";

import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trophy, 
  LogIn, 
  RefreshCw, 
  SlidersHorizontal, 
  CheckCircle, 
  AlertCircle, 
  Calendar, 
  X,
  Database
} from "lucide-react";
import { useEffect, useState } from "react";
import { Match, Prediction, UserProfile } from "@/types";
import { getMatches, getUserPredictions, updateUserDisplayName, deleteUserAccountData } from "@/lib/db";
import MatchCard from "@/components/predictions/MatchCard";
import Leaderboard from "@/components/leaderboard/Leaderboard";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, getDoc, writeBatch, query, orderBy } from "firebase/firestore";

export default function Home() {
  const { user, loading, error, signInWithGoogle, logout } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"predictions" | "leaderboard" | "profile">("predictions");

  // Syncing states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<{
    matchesUpdated: number;
    predictionsUpdated: number;
    usersUpdated: number;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Filter states (initialized from local storage if possible)
  const [stageFilter, setStageFilter] = useState<"all" | "group" | "playoff">("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "finished">("all");

  // Profile states
  const [customDisplayName, setCustomDisplayName] = useState(user?.displayName || "");
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  // Delete account states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setIsLoadingData(true);
    setFetchError(null);
    try {
      const fetchedMatches = await getMatches(); // Fetches sorted by kickoffTime
      const fetchedPredictions = await getUserPredictions(user.uid);
      setMatches(fetchedMatches);
      setPredictions(fetchedPredictions);

      // Load name from user profile
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.displayName) {
          setCustomDisplayName(data.displayName);
        }
      }
    } catch (err: any) {
      console.error("Error fetching data", err);
      setFetchError(`Error de Firestore: ${err?.message || err?.toString()}`);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Load filters from localStorage after component mounts
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedStage = localStorage.getItem("prode_stage_filter") as any;
      const savedGroup = localStorage.getItem("prode_group_filter");
      const savedStatus = localStorage.getItem("prode_status_filter") as any;
      
      if (savedStage) setStageFilter(savedStage);
      if (savedGroup) setGroupFilter(savedGroup);
      if (savedStatus) setStatusFilter(savedStatus);
    }
  }, []);

  // Filter changes handlers
  const changeStageFilter = (val: "all" | "group" | "playoff") => {
    setStageFilter(val);
    localStorage.setItem("prode_stage_filter", val);
    if (val === "playoff" || val === "all") {
      setGroupFilter("all");
      localStorage.setItem("prode_group_filter", "all");
    }
  };

  const changeGroupFilter = (val: string) => {
    setGroupFilter(val);
    localStorage.setItem("prode_group_filter", val);
  };

  const changeStatusFilter = (val: "all" | "pending" | "finished") => {
    setStatusFilter(val);
    localStorage.setItem("prode_status_filter", val);
  };

  const handlePredictionSaved = (updatedPrediction: Prediction) => {
    setPredictions((prev) => {
      const idx = prev.findIndex((p) => p.matchId === updatedPrediction.matchId);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = updatedPrediction;
        return next;
      } else {
        return [...prev, updatedPrediction];
      }
    });
  };

  // Score calculation logic:
  // 3 points: exact score
  // 1 point: correct outcome (winner or draw) but incorrect score
  // 0 points: incorrect outcome
  const calculatePoints = (
    predA: number | null,
    predB: number | null,
    actA: number,
    actB: number
  ): number => {
    if (predA === null || predB === null) return 0;

    const predWinner = predA > predB ? "A" : predA < predB ? "B" : "Draw";
    const actWinner = actA > actB ? "A" : actA < actB ? "B" : "Draw";

    if (predA === actA && predB === actB) {
      return 3;
    } else if (predWinner === actWinner) {
      return 1;
    } else {
      return 0;
    }
  };

  const handleSyncResults = async () => {
    if (!user) return;
    setIsSyncing(true);
    setSyncSummary(null);
    setSyncError(null);
    try {
      // 1. Fetch live matches from proxy API
      const response = await fetch("/api/cron/update-results");
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Ocurrió un error al consultar resultados con la API.");
      }

      const apiMatches = data.apiMatches || [];

      // 2. Fetch current Firestore matches (ordered by kickoffTime), predictions, and users
      const matchesRef = collection(db, "matches");
      const qMatches = query(matchesRef, orderBy("kickoffTime", "asc"));
      const matchesSnap = await getDocs(qMatches);
      const currentMatches = matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));

      const predictionsRef = collection(db, "predictions");
      const predictionsSnap = await getDocs(predictionsRef);
      const currentPredictions = predictionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prediction));

      const usersRef = collection(db, "users");
      const usersSnap = await getDocs(usersRef);
      const currentUsers = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));

      // 3. Process changes and compile Firestore batch updates
      const batch = writeBatch(db);
      let matchesUpdated = 0;
      let predictionsUpdated = 0;
      let usersUpdated = 0;

      const userScores: Record<string, number> = {};
      currentUsers.forEach(u => {
        userScores[u.uid] = 0;
      });

      const now = new Date();

      const updatedMatches = currentMatches.map((match) => {
        let status = match.status;
        let actualScoreA = match.actualScoreA;
        let actualScoreB = match.actualScoreB;
        let matchChanged = false;

        if (apiMatches.length > 0) {
          // Find match in external API results by ID first, then fallback to country codes
          let apiMatch = apiMatches.find((m: any) => String(m.id) === match.id);
          
          if (!apiMatch) {
            apiMatch = apiMatches.find((m: any) => 
              (m.homeTeam.tla === match.teamA.code && m.awayTeam.tla === match.teamB.code) ||
              (m.homeTeam.tla === match.teamB.code && m.awayTeam.tla === match.teamA.code)
            );
          }

          if (apiMatch) {
            const isHomeTeamA = apiMatch.homeTeam.tla === match.teamA.code || apiMatch.homeTeam.name === match.teamA.name;
            const apiStatus = apiMatch.status;
            
            let newStatus: typeof match.status = "scheduled";
            if (apiStatus === "FINISHED") newStatus = "finished";
            else if (["IN_PLAY", "LIVE", "PAUSED"].includes(apiStatus)) newStatus = "in_play";

            const newScoreA = isHomeTeamA ? apiMatch.score.fullTime.home : apiMatch.score.fullTime.away;
            const newScoreB = isHomeTeamA ? apiMatch.score.fullTime.away : apiMatch.score.fullTime.home;

            if (status !== newStatus || actualScoreA !== newScoreA || actualScoreB !== newScoreB) {
              status = newStatus;
              actualScoreA = newScoreA;
              actualScoreB = newScoreB;
              matchChanged = true;
            }
          }
        } else {
          // Mock Mode: Auto-finish scheduled matches whose kickoff time is in the past
          const kickoff = new Date(match.kickoffTime);
          if (status === "scheduled" && kickoff <= now) {
            status = "finished";
            actualScoreA = Math.floor(Math.random() * 4);
            actualScoreB = Math.floor(Math.random() * 4);
            matchChanged = true;
          }
        }

        if (matchChanged) {
          const matchRefDoc = doc(db, "matches", match.id);
          batch.update(matchRefDoc, {
            status,
            actualScoreA,
            actualScoreB
          });
          matchesUpdated++;
        }

        return {
          ...match,
          status,
          actualScoreA,
          actualScoreB
        };
      });

      // Create quick lookup map
      const matchesMap = new Map<string, Match>();
      updatedMatches.forEach(m => matchesMap.set(m.id, m));

      // Calculate predictions
      currentPredictions.forEach((pred) => {
        const match = matchesMap.get(pred.matchId);
        if (!match) return;

        let pointsEarned: number | null = null;

        if (match.status === "finished" && match.actualScoreA !== null && match.actualScoreB !== null) {
          pointsEarned = calculatePoints(
            pred.predictedScoreA,
            pred.predictedScoreB,
            match.actualScoreA,
            match.actualScoreB
          );
        }

        if (pred.pointsEarned !== pointsEarned) {
          const predRefDoc = doc(db, "predictions", pred.id);
          batch.update(predRefDoc, { pointsEarned });
          predictionsUpdated++;
        }

        if (pointsEarned !== null && userScores[pred.userId] !== undefined) {
          userScores[pred.userId] += pointsEarned;
        }
      });

      // Update user scores
      currentUsers.forEach((u) => {
        const calculatedScore = userScores[u.uid] || 0;
        if (u.totalScore !== calculatedScore) {
          const userRefDoc = doc(db, "users", u.uid);
          batch.update(userRefDoc, { totalScore: calculatedScore });
          usersUpdated++;
        }
      });

      // Commit all writes
      if (matchesUpdated > 0 || predictionsUpdated > 0 || usersUpdated > 0) {
        await batch.commit();
      }

      setSyncSummary({
        matchesUpdated,
        predictionsUpdated,
        usersUpdated
      });

      // Refresh state, keeping them ordered by kickoffTime
      setMatches(updatedMatches);
      const fetchedPredictions = await getUserPredictions(user.uid);
      setPredictions(fetchedPredictions);

    } catch (err: any) {
      console.error("Error executing client-side sync:", err);
      setSyncError(err.message || "Error al sincronizar resultados.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateName = async () => {
    if (!user || !customDisplayName.trim()) return;
    setIsSavingName(true);
    setNameSaved(false);
    try {
      // 1. Update Firestore
      await updateUserDisplayName(user.uid, customDisplayName.trim());
      
      // 2. Update Firebase Auth Profile (if currentUser is available)
      const { auth } = await import("@/lib/firebase");
      const { updateProfile } = await import("firebase/auth");
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: customDisplayName.trim() });
      }
      
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 3000);
    } catch (err: any) {
      console.error("Error updating display name:", err);
      setSyncError("No se pudo actualizar el nombre. Intenta de nuevo.");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !confirmDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      // 1. Delete Firestore data (profile + predictions)
      await deleteUserAccountData(user.uid);
      
      // 2. Try to delete from Firebase Auth
      try {
        const { auth } = await import("@/lib/firebase");
        const { deleteUser } = await import("firebase/auth");
        
        if (auth.currentUser) {
          await deleteUser(auth.currentUser);
        }
      } catch (authErr) {
        console.warn("Auth user deletion failed (requires recent login), signing out instead", authErr);
        // Fallback: since Firestore data is deleted, signing them out is sufficient to clear their account in-app
        const { auth } = await import("@/lib/firebase");
        const { signOut } = await import("firebase/auth");
        await signOut(auth);
      }
      
      // Unmount delete modal safely
      setShowDeleteModal(false);
      setConfirmDelete(false);
    } catch (err: any) {
      console.error("Error during account deletion process:", err);
      setSyncError(`Error al eliminar la cuenta: ${err.message || err.toString()}`);
      setShowDeleteModal(false);
      setConfirmDelete(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // Get unique groups from matches
  const availableGroups = Array.from(
    new Set(matches.map((m) => m.group).filter(Boolean))
  ) as string[];
  availableGroups.sort();

  // Filter logic
  const filteredMatches = matches.filter((match) => {
    // Stage Filter
    if (stageFilter !== "all" && match.stage !== stageFilter) return false;
    
    // Group Filter
    if (stageFilter === "group" && groupFilter !== "all" && match.group !== groupFilter) return false;
    if (stageFilter === "all" && groupFilter !== "all" && match.group !== groupFilter) return false;
    
    // Status Filter
    if (statusFilter === "pending" && match.status === "finished") return false;
    if (statusFilter === "finished" && match.status !== "finished") return false;
    
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[100px] rounded-full" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="glass p-6 md:p-12 rounded-3xl max-w-md w-full mx-4 text-center z-10 relative"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-gold to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-gold/20"
          >
            <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </motion.div>
          
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight">Prode Mundial</h1>
          <p className="text-foreground/70 text-sm mb-8">Demuestra que sabes más de fútbol que tus amigos.</p>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-left whitespace-pre-wrap break-words">
              <strong className="block mb-1">Error de configuración o conexión:</strong>
              {error}
            </div>
          )}
          
          <button
            onClick={signInWithGoogle}
            className="w-full bg-white text-gray-900 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer text-sm sm:text-base"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar con Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass sticky top-0 z-50 border-x-0 border-t-0 rounded-none px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-gold" />
          <span className="font-bold text-base sm:text-lg tracking-tight">Prode 2026</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/seed"
            className="text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-xl border border-card-border hover:border-gold/30 hover:bg-gold/5 flex items-center gap-1 sm:gap-1.5 transition-all text-foreground/80 hover:text-gold"
            title="Cargar fixture"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cargar Partidos</span>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <img src={user.photoURL || ""} alt="Avatar" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-card-border" />
            <span className="text-xs sm:text-sm font-medium hidden md:block">{customDisplayName || user.displayName}</span>
          </div>
          <button onClick={logout} className="p-1.5 sm:p-2 rounded-full hover:bg-foreground/5 transition-colors cursor-pointer" title="Cerrar Sesión">
            <LogIn className="w-4 h-4 sm:w-5 sm:h-5 text-foreground/70" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full">
        {(error || fetchError) && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs sm:text-sm text-left whitespace-pre-wrap">
            <strong className="block mb-1">Mensaje del Sistema:</strong>
            {error || fetchError}
          </div>
        )}

        {/* Sync Status Notifications */}
        <AnimatePresence>
          {syncSummary && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="glass p-3 sm:p-4 rounded-2xl border-green-500/30 bg-green-500/5 text-green-500 flex items-start justify-between gap-3 overflow-hidden shadow-sm"
            >
              <div className="flex gap-2.5 items-start">
                <CheckCircle className="w-4 h-4 sm:w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-xs sm:text-sm">Sincronización Exitosa</h4>
                  <p className="text-[11px] sm:text-xs text-foreground/80 mt-0.5">
                    Se han actualizado {syncSummary.matchesUpdated} partidos y {syncSummary.predictionsUpdated} predicciones. Se recalcularon los puntos de los usuarios participantes.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSyncSummary(null)}
                className="text-foreground/50 hover:text-foreground/80 transition-colors p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}

          {syncError && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="glass p-3 sm:p-4 rounded-2xl border-red-500/30 bg-red-500/5 text-red-400 flex items-start justify-between gap-3 overflow-hidden shadow-sm"
            >
              <div className="flex gap-2.5 items-start">
                <AlertCircle className="w-4 h-4 sm:w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-xs sm:text-sm">Mensaje del Sistema</h4>
                  <p className="text-[11px] sm:text-xs opacity-90 mt-0.5">{syncError}</p>
                </div>
              </div>
              <button 
                onClick={() => setSyncError(null)}
                className="text-foreground/50 hover:text-foreground/80 transition-colors p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Selector & Sync controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="flex bg-card/45 border border-card-border p-0.5 sm:p-1 rounded-2xl max-w-md w-full sm:w-auto relative">
            <button
              onClick={() => setActiveTab("predictions")}
              className={`flex-1 py-2 px-2.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-colors duration-300 flex items-center justify-center gap-1 sm:gap-2 relative z-10 cursor-pointer ${
                activeTab === "predictions" ? "text-white" : "text-foreground/70 hover:text-foreground"
              }`}
            >
              {activeTab === "predictions" && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 bg-gold rounded-xl -z-10 shadow-md shadow-gold/20"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Trophy className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Predicciones</span>
            </button>
            <button
              onClick={() => setActiveTab("leaderboard")}
              className={`flex-1 py-2 px-2.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-colors duration-300 flex items-center justify-center gap-1 sm:gap-2 relative z-10 cursor-pointer ${
                activeTab === "leaderboard" ? "text-white" : "text-foreground/70 hover:text-foreground"
              }`}
            >
              {activeTab === "leaderboard" && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 bg-gold rounded-xl -z-10 shadow-md shadow-gold/20"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
              </svg>
              <span>Clasificación</span>
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex-1 py-2 px-2.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-colors duration-300 flex items-center justify-center gap-1 sm:gap-2 relative z-10 cursor-pointer ${
                activeTab === "profile" ? "text-white" : "text-foreground/70 hover:text-foreground"
              }`}
            >
              {activeTab === "profile" && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 bg-gold rounded-xl -z-10 shadow-md shadow-gold/20"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Mi Perfil</span>
            </button>
          </div>

          {activeTab === "predictions" && matches.length > 0 && (
            <button
              onClick={handleSyncResults}
              disabled={isSyncing}
              className="w-full sm:w-auto bg-gold hover:bg-yellow-600 disabled:bg-foreground/10 text-white font-bold py-2 sm:py-2.5 px-4 sm:px-5 rounded-xl sm:rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-gold/10"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Sincronizando..." : "Sincronizar Resultados"}
            </button>
          )}
        </div>

        {activeTab === "predictions" ? (
          <>
            {/* Header controls & Filters */}
            <div className="flex flex-col gap-3 sm:gap-4 mb-5 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold mb-0.5">Tus Predicciones</h2>
                <p className="text-foreground/60 text-xs sm:text-sm">Pronostica los resultados del fixture oficial.</p>
              </div>

              {matches.length > 0 && (
                <div className="glass p-3 sm:p-4 rounded-2xl sm:rounded-3xl space-y-3 sm:space-y-4 border border-card-border/60">
                  <div className="flex items-center gap-2 text-foreground/80 font-bold text-[10px] sm:text-xs border-b border-card-border/50 pb-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                    <span>FILTRAR PARTIDOS ({filteredMatches.length} de {matches.length})</span>
                  </div>

                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                    {/* Stage Filter */}
                    <div className="space-y-1">
                      <label className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-foreground/50">Fase</label>
                      <div className="flex bg-background border border-card-border/80 p-0.5 rounded-xl text-[11px] sm:text-xs">
                        <button
                          onClick={() => changeStageFilter("all")}
                          className={`flex-1 py-1 sm:py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${stageFilter === "all" ? "bg-gold text-white" : "text-foreground/70"}`}
                        >
                          Todos
                        </button>
                        <button
                          onClick={() => changeStageFilter("group")}
                          className={`flex-1 py-1 sm:py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${stageFilter === "group" ? "bg-gold text-white" : "text-foreground/70"}`}
                        >
                          Grupos
                        </button>
                        <button
                          onClick={() => changeStageFilter("playoff")}
                          className={`flex-1 py-1 sm:py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${stageFilter === "playoff" ? "bg-gold text-white" : "text-foreground/70"}`}
                        >
                          Eliminatorias
                        </button>
                      </div>
                    </div>

                    {/* Group Selector */}
                    <div className="space-y-1">
                      <label className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-foreground/50">Grupo</label>
                      <select
                        value={groupFilter}
                        onChange={(e) => changeGroupFilter(e.target.value)}
                        disabled={stageFilter === "playoff"}
                        className="w-full h-8 sm:h-[34px] bg-background border border-card-border/85 rounded-xl px-2 sm:px-3 py-1 text-xs text-foreground font-semibold focus:outline-none focus:border-gold transition-all disabled:opacity-40"
                      >
                        <option value="all">Todos los grupos</option>
                        {availableGroups.map((g) => (
                          <option key={g} value={g}>
                            Grupo {g}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-1">
                      <label className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-foreground/50">Estado</label>
                      <div className="flex bg-background border border-card-border/80 p-0.5 rounded-xl text-[11px] sm:text-xs">
                        <button
                          onClick={() => changeStatusFilter("all")}
                          className={`flex-1 py-1 sm:py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${statusFilter === "all" ? "bg-gold text-white" : "text-foreground/70"}`}
                        >
                          Todos
                        </button>
                        <button
                          onClick={() => changeStatusFilter("pending")}
                          className={`flex-1 py-1 sm:py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${statusFilter === "pending" ? "bg-gold text-white" : "text-foreground/70"}`}
                        >
                          Pendientes
                        </button>
                        <button
                          onClick={() => changeStatusFilter("finished")}
                          className={`flex-1 py-1 sm:py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${statusFilter === "finished" ? "bg-gold text-white" : "text-foreground/70"}`}
                        >
                          Finalizados
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {isLoadingData ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
              </div>
            ) : matches.length === 0 ? (
               <div className="glass p-8 sm:p-12 text-center text-foreground/60 rounded-3xl border border-card-border/60">
                 <Calendar className="w-10 h-10 sm:w-12 sm:h-12 text-gold/40 mx-auto mb-4" />
                 <p className="font-semibold text-sm sm:text-base">No hay partidos cargados en la base de datos.</p>
                 <p className="text-[11px] sm:text-xs text-foreground/50 mt-1 mb-6">Inicializa los partidos del Mundial para empezar a jugar.</p>
                 <Link
                   href="/seed"
                   className="inline-flex bg-gold hover:bg-yellow-600 text-white font-bold py-2 sm:py-2.5 px-5 sm:px-6 rounded-xl sm:rounded-2xl text-xs transition-colors items-center gap-2"
                 >
                   <Database className="w-3.5 h-3.5" />
                   Cargar fixture desde API o Local
                 </Link>
               </div>
            ) : filteredMatches.length === 0 ? (
              <div className="text-center py-12 text-xs sm:text-sm text-foreground/50 glass rounded-3xl border border-card-border/40">
                Ningún partido coincide con los filtros aplicados.
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {filteredMatches.map((match) => {
                  const prediction = predictions.find(p => p.matchId === match.id);
                  return (
                    <MatchCard 
                      key={match.id} 
                      match={match} 
                      prediction={prediction} 
                      userId={user.uid} 
                      onPredictionSaved={handlePredictionSaved}
                    />
                  );
                })}
              </div>
            )}
          </>
        ) : activeTab === "leaderboard" ? (
          <Leaderboard currentUserId={user.uid} />
        ) : (
          /* Profile Tab */
          <div className="space-y-6 max-w-xl mx-auto w-full">
            <div className="glass p-4 sm:p-6 rounded-3xl space-y-4 sm:space-y-6 border border-card-border/60">
              <h2 className="text-lg sm:text-xl font-bold text-foreground">Configuración de Perfil</h2>
              
              <div className="flex flex-col items-center gap-3 sm:gap-4 py-3 sm:py-4 border-b border-card-border/45">
                <img
                  src={user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${customDisplayName || user.displayName}`}
                  alt="Avatar"
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-gold shadow-lg object-cover bg-background"
                />
                <span className="text-[10px] sm:text-xs text-foreground/50 font-medium">Avatar de tu cuenta de Google</span>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-foreground/60 block">
                  Nombre para mostrar en Leaderboard
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={customDisplayName}
                    onChange={(e) => setCustomDisplayName(e.target.value)}
                    className="flex-1 h-10 sm:h-11 bg-background border border-card-border rounded-xl px-4 text-xs sm:text-sm font-semibold focus:outline-none focus:border-gold transition-all"
                    placeholder="Tu nombre en el Leaderboard"
                  />
                  <button
                    onClick={handleUpdateName}
                    disabled={isSavingName || !customDisplayName.trim()}
                    className={`h-10 sm:h-11 px-5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5
                      ${nameSaved
                        ? "bg-green-500/20 text-green-600 border border-green-500/30"
                        : "bg-gold text-white hover:bg-yellow-600 disabled:opacity-50"
                      }`}
                  >
                    {nameSaved ? (
                      <>
                        <CheckCircle className="w-4 h-4 flex-shrink-0" /> Guardado
                      </>
                    ) : isSavingName ? (
                      "Guardando..."
                    ) : (
                      "Guardar"
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="glass p-4 sm:p-6 rounded-3xl border border-red-500/25 bg-red-500/5 space-y-3 sm:space-y-4">
              <h3 className="text-sm sm:text-base font-bold text-red-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 sm:w-5 h-5 flex-shrink-0" />
                Zona de Peligro
              </h3>
              <p className="text-[11px] sm:text-xs text-foreground/75 leading-relaxed">
                Si eliminas tu cuenta, se borrarán todos tus datos de Firestore (predicciones, perfil, puntaje acumulado) y tu cuenta de autenticación de forma permanente.
              </p>
              
              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full sm:w-auto bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 font-bold py-2 sm:py-2.5 px-4 sm:px-5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Eliminar mi cuenta
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Delete Account Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            
            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass max-w-md w-full p-5 sm:p-6 rounded-3xl border border-red-500/30 bg-card z-10 space-y-5 sm:space-y-6 text-center relative"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-500/15 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              
              <div className="space-y-1.5 sm:space-y-2">
                <h3 className="text-lg sm:text-xl font-bold text-red-500">¿Eliminar cuenta permanentemente?</h3>
                <p className="text-xs sm:text-sm text-foreground/75 leading-relaxed">
                  Esta acción es **completamente irreversible**. Se perderán todas tus predicciones guardadas, tu perfil y tus puntos en el leaderboard.
                </p>
              </div>

              <div className="flex items-start gap-2.5 text-left p-3 rounded-xl bg-foreground/5 border border-card-border/50">
                <input
                  type="checkbox"
                  id="confirm-delete-checkbox"
                  checked={confirmDelete}
                  onChange={(e) => setConfirmDelete(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-red-500 rounded cursor-pointer flex-shrink-0"
                />
                <label htmlFor="confirm-delete-checkbox" className="text-[10px] sm:text-xs text-foreground/80 font-medium select-none cursor-pointer leading-normal">
                  Entiendo que esta acción es irreversible y quiero eliminar permanentemente todos mis datos.
                </label>
              </div>

              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setConfirmDelete(false);
                  }}
                  className="flex-1 bg-foreground/5 hover:bg-foreground/10 border border-card-border/80 font-semibold py-2 sm:py-2.5 rounded-xl text-xs transition-colors cursor-pointer h-10 flex items-center justify-center"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={!confirmDelete || isDeleting}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-bold py-2 sm:py-2.5 rounded-xl text-xs transition-colors cursor-pointer h-10 flex items-center justify-center"
                >
                  {isDeleting ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
