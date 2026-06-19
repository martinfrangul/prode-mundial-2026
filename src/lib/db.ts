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
import { Match, Prediction, UserProfile } from "@/types";

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

export async function savePrediction(userId: string, matchId: string, scoreA: number, scoreB: number) {
  const predictionId = `${userId}_${matchId}`;
  const predictionRef = doc(db, "predictions", predictionId);
  
  await setDoc(predictionRef, {
    id: predictionId,
    userId,
    matchId,
    predictedScoreA: scoreA,
    predictedScoreB: scoreB,
    pointsEarned: null
  }, { merge: true });
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
  
  await batch.commit();
}
