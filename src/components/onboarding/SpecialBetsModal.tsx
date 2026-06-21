"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Star, TrendingUp, X, ChevronRight, ChevronLeft } from "lucide-react";
import { markSpecialModalSeen } from "@/lib/db";

interface SpecialBetsModalProps {
  userId: string;
  onClose: () => void;
}

export default function SpecialBetsModal({ userId, onClose }: SpecialBetsModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  const slides = [
    {
      title: "¡Nuevas Apuestas Especiales!",
      description: "Ahora puedes predecir los 4 semifinalistas y el campeón del Mundial para ganar puntos extra.",
      icon: <Star className="w-12 h-12 text-gold" />,
    },
    {
      title: "Puntos Bonus (Al finalizar)",
      description: "Ganarás 15 puntos si aciertas el campeón. Por semifinalistas: 10 pts por acertar los 4, 8 pts por 3, 5 pts por 2, y 3 pts por 1.",
      icon: <TrendingUp className="w-12 h-12 text-green-400" />,
    },
    {
      title: "Fecha Límite",
      description: "Tienes tiempo hasta el 23 de Junio a las 23:59 (Hora de España) para guardar tus apuestas. Una vez pasada la fecha, se harán públicas en la sección de Clasificación.",
      icon: <Trophy className="w-12 h-12 text-blue-400" />,
    }
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  const handleClose = async () => {
    setIsClosing(true);
    try {
      await markSpecialModalSeen(userId);
    } catch (e) {
      console.error("Error marking modal as seen", e);
    }
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: isClosing ? 0 : 1, scale: isClosing ? 0.95 : 1, y: isClosing ? 20 : 0 }}
        className="glass relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-gold/30 bg-card/90 flex flex-col"
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-foreground/10 text-foreground/50 hover:text-foreground transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 pb-4 text-center min-h-[260px] flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center"
            >
              <div className="mb-6 p-4 rounded-full bg-foreground/5 shadow-inner">
                {slides[currentSlide].icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{slides[currentSlide].title}</h3>
              <p className="text-foreground/70 text-sm leading-relaxed">
                {slides[currentSlide].description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Indicators */}
        <div className="flex justify-center gap-2 mb-6">
          {slides.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentSlide ? "w-6 bg-gold" : "w-2 bg-foreground/20"
              }`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="p-6 pt-0 flex items-center justify-between gap-4">
          <button
            onClick={handlePrev}
            disabled={currentSlide === 0}
            className={`p-3 rounded-xl flex items-center justify-center transition-colors ${
              currentSlide === 0 ? "opacity-0 pointer-events-none" : "bg-foreground/5 hover:bg-foreground/10 text-foreground/80"
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleNext}
            className="flex-1 bg-gold hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-gold/20"
          >
            {currentSlide === slides.length - 1 ? "¡Entendido!" : "Siguiente"}
            {currentSlide !== slides.length - 1 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
