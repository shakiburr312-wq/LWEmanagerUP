// New file /src/utils/mvp.ts - Helper function for calculating Season-based player performance and MVP rankings
import { PlayerProfile, PerformanceLog, MVPSettings } from '../types';

export interface SeasonRankedPlayer extends PlayerProfile {
  score: number;
  kills: number;
  damage: number;
  matches: number;
  booyahs: number;
}

/**
 * Filter performance logs by season start date, group and aggregate metrics, and compute MVP scores.
 */
export function getSeasonRankedPlayers(
  players: PlayerProfile[],
  logs: PerformanceLog[],
  settings: MVPSettings
): SeasonRankedPlayer[] {
  // Only active players are eligible for season-based rankings and MVP
  const activePlayers = players.filter(p => p.status === 'active');
  const seasonStartDate = settings.seasonStartDate || new Date().toISOString();

  // Filter logs that are within the current season
  const seasonLogs = logs.filter(log => log.date >= seasonStartDate);

  // Group metrics by player ID
  const playerStatsMap: Record<string, { kills: number; damage: number; matches: number; booyahs: number }> = {};
  
  activePlayers.forEach(p => {
    playerStatsMap[p.id] = { kills: 0, damage: 0, matches: 0, booyahs: 0 };
  });

  seasonLogs.forEach(log => {
    if (playerStatsMap[log.playerId]) {
      playerStatsMap[log.playerId].kills += Number(log.kills) || 0;
      playerStatsMap[log.playerId].damage += Number(log.damage) || 0;
      playerStatsMap[log.playerId].matches += Number(log.matches) || 0;
      playerStatsMap[log.playerId].booyahs += Number(log.booyahs) || 0;
    }
  });

  // Map and calculate MVP scores
  const ranked = activePlayers.map(p => {
    const stats = playerStatsMap[p.id];
    const totalKills = stats.kills;
    const totalDamage = stats.damage;
    const totalMatches = stats.matches;
    const totalBooyahs = stats.booyahs;

    // Formula: (totalKills × killsWeight) + (totalDamage × damageWeight) + ((totalMatches > 0 ? totalKills/divisor : 0) × kdWeight)
    const deaths = totalMatches - totalBooyahs;
    const divisor = Math.max(1, deaths);
    const averageKd = totalMatches > 0 ? (totalKills / divisor) : 0;
    const score = (totalKills * settings.killsWeight) + 
                  (totalDamage * settings.damageWeight) + 
                  (averageKd * settings.kdWeight);

    return {
      ...p,
      kills: totalKills,
      damage: totalDamage,
      matches: totalMatches,
      booyahs: totalBooyahs,
      score: Number(score.toFixed(1))
    };
  });

  // Sort descending by score
  return ranked.sort((a, b) => b.score - a.score);
}
