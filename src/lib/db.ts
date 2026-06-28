import { db } from "./firebase";
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  query, 
  where, 
  orderBy,
  writeBatch
} from "firebase/firestore";
import { Match, Prediction, UserProfile, SpecialPrediction } from "@/types";

// User Functions
export async function initializeUserProfile(user: any) {
  if (!user?.uid) return;
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
      totalScore: 0
    });
  }
}

export async function getUserLeaderboard(): Promise<UserProfile[]> {
  const usersRef = collection(db, "users");
  const q = query(usersRef, orderBy("totalScore", "desc"));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    uid: doc.id,
    ...doc.data()
  } as UserProfile));
}

// Matches Functions
export async function getMatches(): Promise<Match[]> {
  const matchesRef = collection(db, "matches");
  const q = query(matchesRef, orderBy("kickoffTime", "asc"));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Match));
}

// Predictions Functions
export async function getUserPredictions(userId: string): Promise<Prediction[]> {
  const predictionsRef = collection(db, "predictions");
  const q = query(predictionsRef, where("userId", "==", userId));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Prediction));
}

export async function savePrediction(userId: string, matchId: string, scoreA: number, scoreB: number, predictedAdvancingTeam?: string) {
  const predictionId = `${userId}_${matchId}`;
  const predictionRef = doc(db, "predictions", predictionId);
  
  const data: any = {
    id: predictionId,
    userId,
    matchId,
    predictedScoreA: scoreA,
    predictedScoreB: scoreB,
    pointsEarned: null
  };
  
  if (predictedAdvancingTeam !== undefined) {
    data.predictedAdvancingTeam = predictedAdvancingTeam;
  }
  
  await setDoc(predictionRef, data, { merge: true });
}

export async function updateUserDisplayName(userId: string, displayName: string) {
  const userRef = doc(db, "users", userId);
  await setDoc(userRef, { displayName }, { merge: true });
}

export async function deleteUserAccountData(userId: string) {
  const batch = writeBatch(db);
  
  // 1. Delete user profile doc
  const userRef = doc(db, "users", userId);
  batch.delete(userRef);
  
  // 2. Query and delete user predictions
  const predictionsRef = collection(db, "predictions");
  const q = query(predictionsRef, where("userId", "==", userId));
  const predictionsSnap = await getDocs(q);
  predictionsSnap.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  // 3. Delete special predictions
  const specialRef = doc(db, "special_predictions", userId);
  batch.delete(specialRef);
  
  await batch.commit();
}

// Special Predictions Functions
export async function getSpecialPrediction(userId: string): Promise<SpecialPrediction | null> {
  const specialRef = doc(db, "special_predictions", userId);
  const snap = await getDoc(specialRef);
  if (snap.exists()) {
    return snap.data() as SpecialPrediction;
  }
  return null;
}

export async function getAllSpecialPredictions(): Promise<SpecialPrediction[]> {
  const specialRef = collection(db, "special_predictions");
  const snap = await getDocs(specialRef);
  return snap.docs.map(doc => doc.data() as SpecialPrediction);
}

export async function saveSpecialPrediction(userId: string, finalists: string[], winner: string) {
  const specialRef = doc(db, "special_predictions", userId);
  await setDoc(specialRef, {
    userId,
    finalists,
    winner,
    pointsEarned: null
  }, { merge: true });
}

export async function markSpecialModalSeen(userId: string) {
  const userRef = doc(db, "users", userId);
  await setDoc(userRef, { hasSeenSpecialModal: true }, { merge: true });
}
