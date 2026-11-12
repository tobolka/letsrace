/**
 * Names that say "ride without a result": a brevet, an RTF or CTF, a rajd, a randonnée. Before anyone looks for
 * such an entry's regulations, the question is whether it belongs in a race calendar at all.
 * A marathon or gran fondo is not in this list: those are timed and ranked unless their page says otherwise.
 */
export const looksLikeRide = (name: string) => /\b(brevet|brm|rtf|ctf|audax|randonn\w*|rajd\w*|permanente?|radtourenfahrt|radtouristik\w*|country[- ]?tourenfahrt|vyjizdka|spanil\w* jizd\w*|cicloturistic\w*|pedalata|social ride)\b/i.test(name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
