// ponytail: env flags, one line each.
// Radar is the front door; NEXT_PUBLIC_RADAR_ENABLED=false turns it off.
export const RADAR_ENABLED = process.env.NEXT_PUBLIC_RADAR_ENABLED !== "false"
