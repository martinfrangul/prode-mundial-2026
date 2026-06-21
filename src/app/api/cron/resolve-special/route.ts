import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { SpecialPrediction } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { finalists, winner } = body;

    if (!finalists || !Array.isArray(finalists) || finalists.length !== 4) {
      return NextResponse.json(
        {
          success: false,
          error: "Debes proveer un arreglo de 4 semifinalistas (finalists).",
        },
        { status: 400 },
      );
    }

    if (!winner || typeof winner !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Debes proveer un string con el código del campeón (winner).",
        },
        { status: 400 },
      );
    }

    // Obtener todas las predicciones especiales
    const specialRef = collection(db, "special_predictions");
    const specialSnap = await getDocs(specialRef);
    const predictions = specialSnap.docs.map(
      (doc) => doc.data() as SpecialPrediction,
    );

    const batch = writeBatch(db);
    let updatedCount = 0;

    predictions.forEach((pred) => {
      let points = 0;

      // Calcular puntos por campeón (15 puntos)
      if (pred.winner === winner) {
        points += 15;
      }

      // Calcular puntos por semifinalistas
      let correctFinalistsCount = 0;
      pred.finalists.forEach((team) => {
        if (team && finalists.includes(team)) {
          correctFinalistsCount++;
        }
      });

      if (correctFinalistsCount === 4) {
        points += 10;
      } else if (correctFinalistsCount === 3) {
        points += 8;
      } else if (correctFinalistsCount === 2) {
        points += 5;
      } else if (correctFinalistsCount === 1) {
        points += 3;
      }

      // Actualizar si los puntos cambiaron o estaban nulos
      if (pred.pointsEarned !== points) {
        const docRef = doc(db, "special_predictions", pred.userId);
        batch.update(docRef, { pointsEarned: points });
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      message: `Se actualizaron las predicciones especiales de ${updatedCount} usuarios. Recuerda presionar el botón de sincronizar resultados en la interfaz web para reflejar estos puntos en la tabla general.`,
      updatedCount,
    });
  } catch (error: any) {
    console.error("Error resolviendo apuestas especiales:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor." },
      { status: 500 },
    );
  }
}
