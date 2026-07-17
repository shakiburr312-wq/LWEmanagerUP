/**
 * Helper to calculate the Season Name dynamically based on seasonStartDate.
 * If July 2026 is the base (Season 1), each consecutive month increments the season number.
 */
export function getSeasonName(seasonStartDateStr?: string): string {
  if (!seasonStartDateStr) return "SEASON 1";
  
  try {
    const date = new Date(seasonStartDateStr);
    if (isNaN(date.getTime())) {
      return "SEASON 1";
    }
    
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11
    
    // July 2026 is index 0 (Month = 6, Year = 2026)
    const diffMonths = (year - 2026) * 12 + (month - 6);
    const seasonNum = Math.max(1, diffMonths + 1);
    
    const monthNames = [
      "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
      "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
    ];
    const monthName = monthNames[month] || "JULY";
    
    return `SEASON ${seasonNum}`;
  } catch (e) {
    return "SEASON 1";
  }
}

/**
 * Helper to calculate the Season Code dynamically based on seasonStartDate.
 * E.g., July 2026 is Season 1, so it returns "S1".
 */
export function getSeasonCode(seasonStartDateStr?: string): string {
  if (!seasonStartDateStr) return "S1";
  try {
    const date = new Date(seasonStartDateStr);
    if (isNaN(date.getTime())) return "S1";
    const year = date.getFullYear();
    const month = date.getMonth();
    const diffMonths = (year - 2026) * 12 + (month - 6);
    const seasonNum = Math.max(1, diffMonths + 1);
    return `S${seasonNum}`;
  } catch (e) {
    return "S1";
  }
}
