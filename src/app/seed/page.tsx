"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Globe, AlertTriangle, ArrowLeft, RefreshCw, FileSpreadsheet } from "lucide-react";
import { motion } from "framer-motion";
import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, getDocs } from "firebase/firestore";
import { Match } from "@/types";

export default function SeedPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "" }>({
    text: "",
    type: ""
  });
  const router = useRouter();

  const handleSeed = async (useLocal: boolean) => {
    setLoading(true);
    setMessage({ text: "", type: "" });
    try {
      // 1. Fetch matches from server proxy API (does not write to DB)
      const url = useLocal ? "/api/matches/seed?local=true" : "/api/matches/seed";
      const response = await fetch(url, { method: "POST" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "Ocurrió un problema al obtener los partidos.");
      }

      const matchesToSeed: Match[] = data.matches || [];
      if (matchesToSeed.length === 0) {
        throw new Error("No se devolvió ningún partido.");
      }

      // 2. Perform Firestore operations client-side (under client authentication)
      const matchesRef = collection(db, "matches");
      const existingSnap = await getDocs(matchesRef);
      
      // Delete old matches in a client-side batch
      const deleteBatch = writeBatch(db);
      existingSnap.docs.forEach((doc) => {
        deleteBatch.delete(doc.ref);
      });
      await deleteBatch.commit();

      // Write new matches in client-side batches (Firestore limit is 500 per batch)
      const chunkSize = 400;
      for (let i = 0; i < matchesToSeed.length; i += chunkSize) {
        const chunk = matchesToSeed.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        
        chunk.forEach((match) => {
          const matchDocRef = doc(db, "matches", match.id);
          batch.set(matchDocRef, match);
        });

        await batch.commit();
      }

      setMessage({
        text: `¡Éxito! Se han importado con éxito ${matchesToSeed.length} partidos desde ${data.source}.`,
        type: "success"
      });
    } catch (error: any) {
      console.error("Error running client-side seed:", error);
      setMessage({
        text: `Error: ${error.message || error.toString()}`,
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gold/5 blur-[120px] rounded-full -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 blur-[120px] rounded-full -z-10" />

      {/* Back button */}
      <button
        onClick={() => router.push("/")}
        className="absolute top-6 left-6 flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors cursor-pointer text-sm font-semibold"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al Inicio
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass p-5 sm:p-8 rounded-3xl max-w-lg w-full text-center relative z-10"
      >
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-gold to-yellow-600 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg shadow-gold/10">
          <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold mb-2 tracking-tight">Carga de Partidos</h1>
        <p className="text-foreground/75 text-xs sm:text-sm mb-6 sm:mb-8">
          Configura y sincroniza los partidos de la Copa del Mundo en tu base de datos de Firestore.
        </p>

        <div className="space-y-4 mb-8 text-left">
          {/* Card Option 1: API */}
          <div className="glass p-4 rounded-2xl border border-card-border/50 hover:border-gold/30 transition-all duration-300">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-gold/10 text-gold mt-0.5">
                <Globe className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm text-foreground">Sincronización Real (API)</h3>
                <p className="text-xs text-foreground/60 mt-1 mb-3">
                  Importa todo el fixture oficial del Mundial desde football-data.org. Requiere configurar <code>FOOTBALL_API_KEY</code> en tu archivo <code>.env.local</code>.
                </p>
                <button
                  onClick={() => handleSeed(false)}
                  disabled={loading}
                  className="w-full bg-gold hover:bg-yellow-600 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    "Importar desde API Real"
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Card Option 2: Fallback Local */}
          <div className="glass p-4 rounded-2xl border border-card-border/50 hover:border-foreground/20 transition-all duration-300">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-foreground/5 text-foreground/70 mt-0.5">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm text-foreground">Carga Local (Sin API Key)</h3>
                <p className="text-xs text-foreground/60 mt-1 mb-3">
                  ¿No tienes una API Key todavía? No hay problema. Carga un fixture de partidos reales preconfigurado para pruebas instantáneas.
                </p>
                <button
                  onClick={() => handleSeed(true)}
                  disabled={loading}
                  className="w-full bg-foreground/10 hover:bg-foreground/15 text-foreground font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    "Cargar Partidos de Prueba (Local)"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* API Key Instructions Alert */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs flex items-start gap-3 text-left mb-6">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <strong className="block mb-0.5">¿Cómo conseguir una API Key?</strong>
            Registra una cuenta gratuita en{" "}
            <a
              href="https://www.football-data.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-bold hover:text-amber-400"
            >
              football-data.org
            </a>
            . Te enviarán la clave por correo electrónico. Luego, agrégala en <code>.env.local</code> como <code>FOOTBALL_API_KEY</code>.
          </div>
        </div>

        {/* Message Banner */}
        {message.text && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`p-4 rounded-2xl text-sm font-semibold mb-2 ${
              message.type === "success"
                ? "bg-green-500/10 border border-green-500/20 text-green-500"
                : "bg-red-500/10 border border-red-500/20 text-red-500"
            }`}
          >
            {message.text}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
