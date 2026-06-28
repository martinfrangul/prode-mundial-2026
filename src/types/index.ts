export interface Team {
  name: string;
  code: string;
  flagUrl?: string;
}

export interface Match {
  id: string;
  teamA: Team;
  teamB: Team;
  kickoffTime: string; // ISO date string
  stage: "group" | "playoff";
  status: "scheduled" | "in_play" | "finished";
  actualScoreA: number | null;
  actualScoreB: number | null;
  group?: string; // e.g., "A", "B"
  penalties?: boolean;
  advancingTeamCode?: string; // Team code that advances (if penalties)
}

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  predictedScoreA: number | null;
  predictedScoreB: number | null;
  predictedAdvancingTeam?: string; // Team code they think will advance (only if draw)
  pointsEarned: number | null;
  advancingPointsEarned?: number | null; // Points earned for predicting the correct advancing team
}

export interface SpecialPrediction {
  userId: string;
  finalists: string[]; // Array of 4 team codes
  winner: string; // Team code
  pointsEarned: number | null;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  totalScore: number;
  hasSeenSpecialModal?: boolean;
}
