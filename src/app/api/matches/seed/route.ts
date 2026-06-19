import { NextRequest, NextResponse } from "next/server";
import { Match } from "@/types";

// Local fallback matches (World Cup 2026 group stage highlights) in case API key is missing
const fallbackMatches: Match[] = [
  {
    id: "api_wc26_01",
    teamA: { name: "México", code: "MEX", flagUrl: "https://crests.football-data.org/794.svg" },
    teamB: { name: "Estados Unidos", code: "USA", flagUrl: "https://crests.football-data.org/772.svg" },
    kickoffTime: "2026-06-11T18:00:00Z",
    stage: "group",
    status: "finished",
    actualScoreA: 2,
    actualScoreB: 1,
    group: "A"
  },
  {
    id: "api_wc26_02",
    teamA: { name: "Canadá", code: "CAN", flagUrl: "https://crests.football-data.org/768.svg" },
    teamB: { name: "Costa Rica", code: "CRC", flagUrl: "https://crests.football-data.org/793.svg" },
    kickoffTime: "2026-06-11T21:00:00Z",
    stage: "group",
    status: "finished",
    actualScoreA: 0,
    actualScoreB: 0,
    group: "A"
  },
  {
    id: "api_wc26_03",
    teamA: { name: "Argentina", code: "ARG", flagUrl: "https://crests.football-data.org/762.svg" },
    teamB: { name: "Arabia Saudita", code: "KSA", flagUrl: "https://crests.football-data.org/801.svg" },
    kickoffTime: "2026-06-12T13:00:00Z",
    stage: "group",
    status: "finished",
    actualScoreA: 3,
    actualScoreB: 0,
    group: "C"
  },
  {
    id: "api_wc26_04",
    teamA: { name: "España", code: "ESP", flagUrl: "https://crests.football-data.org/760.svg" },
    teamB: { name: "Croacia", code: "CRO", flagUrl: "https://crests.football-data.org/799.svg" },
    kickoffTime: "2026-06-12T16:00:00Z",
    stage: "group",
    status: "in_play",
    actualScoreA: 1,
    actualScoreB: 1,
    group: "B"
  },
  {
    id: "api_wc26_05",
    teamA: { name: "Francia", code: "FRA", flagUrl: "https://crests.football-data.org/773.svg" },
    teamB: { name: "Australia", code: "AUS", flagUrl: "https://crests.football-data.org/779.svg" },
    kickoffTime: "2026-06-13T19:00:00Z",
    stage: "group",
    status: "scheduled",
    actualScoreA: null,
    actualScoreB: null,
    group: "D"
  },
  {
    id: "api_wc26_06",
    teamA: { name: "Brasil", code: "BRA", flagUrl: "https://crests.football-data.org/764.svg" },
    teamB: { name: "Alemania", code: "GER", flagUrl: "https://crests.football-data.org/756.svg" },
    kickoffTime: "2026-06-14T20:00:00Z",
    stage: "group",
    status: "scheduled",
    actualScoreA: null,
    actualScoreB: null,
    group: "E"
  },
  {
    id: "api_wc26_07",
    teamA: { name: "Inglaterra", code: "ENG", flagUrl: "https://crests.football-data.org/770.svg" },
    teamB: { name: "Italia", code: "ITA", flagUrl: "https://crests.football-data.org/784.svg" },
    kickoffTime: "2026-06-15T18:00:00Z",
    stage: "group",
    status: "scheduled",
    actualScoreA: null,
    actualScoreB: null,
    group: "F"
  }
];

export async function GET(request: NextRequest) {
  return handleSeed(request);
}

export async function POST(request: NextRequest) {
  return handleSeed(request);
}

async function handleSeed(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const useLocalFallback = searchParams.get("local") === "true";
  const apiKey = process.env.FOOTBALL_API_KEY;

  let matchesToSeed: Match[] = [];
  let source = "";

  try {
    if (apiKey && !useLocalFallback) {
      source = "Football-Data API (Mundial)";
      const response = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
        headers: { "X-Auth-Token": apiKey },
        next: { revalidate: 0 }
      });

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const apiMatches = data.matches || [];

      if (apiMatches.length === 0) {
        throw new Error("La API no devolvió partidos para el Mundial.");
      }

      // Map API matches to our Match format
      matchesToSeed = apiMatches.map((m: any) => {
        const stage = m.stage === "GROUP_STAGE" ? "group" : "playoff";
        
        let status: Match["status"] = "scheduled";
        if (m.status === "FINISHED") status = "finished";
        else if (["IN_PLAY", "LIVE", "PAUSED"].includes(m.status)) status = "in_play";

        const group = m.group ? m.group.replace("GROUP_", "") : undefined;

        return {
          id: String(m.id),
          teamA: {
            name: m.homeTeam.shortName || m.homeTeam.name || "TBD",
            code: m.homeTeam.tla || m.homeTeam.shortName?.substring(0, 3).toUpperCase() || "TBD",
            flagUrl: m.homeTeam.crest || undefined
          },
          teamB: {
            name: m.awayTeam.shortName || m.awayTeam.name || "TBD",
            code: m.awayTeam.tla || m.awayTeam.shortName?.substring(0, 3).toUpperCase() || "TBD",
            flagUrl: m.awayTeam.crest || undefined
          },
          kickoffTime: m.utcDate,
          stage,
          status,
          actualScoreA: m.score?.fullTime?.home !== undefined ? m.score.fullTime.home : null,
          actualScoreB: m.score?.fullTime?.away !== undefined ? m.score.fullTime.away : null,
          ...(group ? { group } : {})
        } as Match;
      });
    } else {
      source = "Mock Local (Mundial 2026)";
      matchesToSeed = fallbackMatches;
    }

    return NextResponse.json({
      success: true,
      source,
      matches: matchesToSeed,
      count: matchesToSeed.length
    });

  } catch (error: any) {
    console.error("Error seeding matches proxy:", error);
    return NextResponse.json({
      success: false,
      error: error.message || error.toString(),
      message: "No se pudieron obtener los partidos de la API."
    }, { status: 500 });
  }
}
