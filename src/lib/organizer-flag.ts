/**
 * The organiser claim flow (claim a race, edit it as its verified organiser, send a correction) is switched off
 * since 20 Nov 2026: nobody used it (0 claims, 0 edits) and nothing links to it. The code and the tables stay, so
 * it can come back with ORGANIZER_CLAIMS=1 in the Worker's variables; until then every entry point answers "not found".
 */
export const organizerClaimsEnabled = () => process.env.ORGANIZER_CLAIMS === "1";
