import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const apiKey = process.env.FOOTBALL_API_KEY;
  let apiMatches: any[] = [];
  let mode = "Mock Mode";

  try {
    // 1. Fetch external API results if key is configured
    if (apiKey) {
      mode = "Real API Mode (football-data.org)";
      const response = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
        headers: { "X-Auth-Token": apiKey },
        next: { revalidate: 0 } // bypass next cache to get fresh results
      });

      if (response.ok) {
        const data = await response.json();
        apiMatches = data.matches || [];
      } else {
        console.warn(`External API responded with status ${response.status}. Falling back to empty matches.`);
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      apiMatches
    });
  } catch (error: any) {
    console.error("Error fetching live matches in proxy:", error);
    return NextResponse.json(
      { success: false, error: error.message || error.toString() },
      { status: 500 }
    );
  }
}
