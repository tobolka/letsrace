import { normalizeName } from "@/lib/domain";

/** Haversine distance in km */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Known series / cup aliases → stable token for matching across languages. */
const SERIES_ALIAS_RULES: { re: RegExp; token: string }[] = [
  {
    re: /\b(cesky\s*pohar|cesky\s*pohar\s*mtb|czech\s*mtb\s*cup|czech\s*cup|cp\s*mtb|[cč]p\s*mtb)\b/i,
    token: "series:cesky_pohar_mtb",
  },
  { re: /\bprima\s*cup\b/i, token: "series:prima_cup" },
  { re: /\btalent\s*cup\b|\btalentcup\b/i, token: "series:talent_cup" },
  { re: /\bmtb\s*biatlon\b/i, token: "series:mtb_biatlon" },
  { re: /\bkolo\s*pro\b|\bkolopro\b/i, token: "series:kolopro" },
  { re: /\bjunior\s*cup\b/i, token: "series:junior_cup" },
  { re: /\byoungsters\s*cup\b|\bayc\b/i, token: "series:youngsters_cup" },
  { re: /\bmountainbike\s*liga\b|\bml-?austria\b/i, token: "series:mountainbike_liga" },
  { re: /\bsportklasse\s*cup\b|\baustria\s*amateur\s*cup\b|\bmtb\s*amateur\s*cup\b|\bamateur\s*cup\b/i, token: "series:sportklasse_cup" },
  { re: /\bkamptal\s*trophy\b.{0,24}\b(kids|youngsters)\b/i, token: "series:kamptal_kids" },
  { re: /\bnachwuchscup\b/i, token: "series:at_nachwuchscup" },
  { re: /\bmtb\s*bundesliga\b|\bgerman\s*cycling\s*(?:mtb\s*)?bundesliga\b/i, token: "series:mtb_bundesliga" },
  { re: /\bnachwuchs(?:s)?bundesliga\b|\bnachwuchssichtung\b|\bnachwuchs-?bl\b/i, token: "series:mtb_nachwuchs_bl" },
  { re: /\bpko\s*(ubezpieczenia\s*)?junior\s*race\b|\bjunior\s*race\b/i, token: "series:pko_junior_race" },
  { re: /\bmnd\s*cup\b/i, token: "series:mnd_cup" },
  { re: /\bškoda\s*cup\b|\bskoda\s*cup\b/i, token: "series:skoda_cup" },
  { re: /\brad[-\s]?bundesliga\b/i, token: "series:rad_bundesliga" },
  { re: /\bsp\s*cc\b|\bslovensky\s*pohar\s*(cc|cestn)/i, token: "series:sp_cc" },
  { re: /\bokolo\s*slovenska\b/i, token: "series:okolo_slovenska" },
  { re: /\bpuchar\s*polski\s*mtb|\bpp\s*mtb\s*xco\b/i, token: "series:puchar_polski_xco" },
  { re: /\bz[aá]vod\s*m[ií]ru\b|\bpeace\s*race\b/i, token: "series:zavod_miru" },
  { re: /\broad\s*cycling\s*league\b/i, token: "series:at_road_league" },
  { re: /\baustrian\s*junior\s*series\b|\barbo\s*asko\b/i, token: "series:at_junior_series" },
  { re: /\bkujebike\b/i, token: "series:kujebike" },
  {
    re: /\bdecathlon\s*cyklomaraton\b.{0,24}\b(d[eě]tsk|kids)\b/i,
    token: "series:decathlon_cyklo_kids",
  },
  {
    re: /^(?!.*\bd[eě]tsk).*\bdecathlon\s*cyklomaraton\b/i,
    token: "series:decathlon_cyklo",
  },
  {
    re: /\bmtb\s*trilogy\b.*\benduro\b/i,
    token: "series:mtb_trilogy_enduro",
  },
  {
    re: /^(?!.*\benduro\b).*\bmtb\s*trilogy\b/i,
    token: "series:mtb_trilogy",
  },
  {
    re: /\bdetske\s*preteky\b.{0,48}bratislavsk|\bbratislavsk[yý]\s*mtb\s*maraton\b.{0,40}\b(detske|kids)\b/i,
    token: "series:bratislava_mtb_kids",
  },
  {
    re: /^(?!.*\bdetske\b).*\bbratislavsk[yý]\s*mtb\s*maraton\b/i,
    token: "series:bratislava_mtb",
  },
  { re: /\bbmx\s*racing\s*league\b/i, token: "series:at_bmx_league" },
  { re: /\bcyclo-?cross\s*bundesliga|\bcx\s*bundesliga\b/i, token: "series:cx_bundesliga" },
  { re: /\bspdh\b/i, token: "series:spdh" },
  { re: /\bspen\b/i, token: "series:spen" },
  { re: /\bnolimited\s*cup\b|\bslovensky\s*pohar\s*(cx|cyklokros)/i, token: "series:sk_cx" },
  { re: /\bcesky\s*pohar\s*bmx|\bcp\s*bmx\b/i, token: "series:cesky_pohar_bmx" },
  { re: /\bslovensky\s*pohar\s*bmx\s*racing/i, token: "series:sk_bmx_racing" },
  { re: /\bslovensky\s*pohar\s*bmx\s*freestyle|\bsp\s*bmx\s*freestyle/i, token: "series:sk_bmx_fs" },
  { re: /\bslovensky\s*pohar\s*trial/i, token: "series:sk_trial" },
  { re: /\bslovensky\s*pohar\s*(na\s*)?drahe|\bslovensky\s*pohar\s*draha/i, token: "series:sk_track" },
  { re: /\blawi\s*tour\b/i, token: "series:lawi_tour" },
  { re: /\broad\s*stage\b/i, token: "series:road_stage" },
  { re: /\bgravel\s*blinduro\b|\bblinduro\b/i, token: "series:blinduro" },
  { re: /\bwest\s*bohemia\s*tour\b/i, token: "series:west_bohemia" },
  { re: /\bauner\s*gravity\b|\baustria(?:n)?\s*(?:auner\s*)?gravity\s*series\b|\baags\b|\baustria(?:n)?\s*downhill\s*cup\b/i, token: "series:at_gravity" },
  { re: /\b(vpace\s*)?kids\s*cup\b/i, token: "series:kids_cup" },
  { re: /\bcube\s*(kids\s*)?cup\b/i, token: "series:cube_cup" },
  { re: /\btbc\b|\btbc\s*s[eé]rie\b/i, token: "series:tbc_cx" },
  { re: /\brookies\s*(dh\s*)?cup\b|\brdc\b/i, token: "series:rookies_dh" },
  { re: /\bixs\s*(european\s*)?(downhill|dh)\s*cup\b|\bixs\s*edc\b|\bixs\s*dhc\b/i, token: "series:ixs_dh" },
  { re: /\bczech\s*enduro|\benduro\s*serie/i, token: "series:czech_enduro" },
  { re: /\bprazsky\s*mtb\s*pohar|pražský\s*mtb\s*pohár/i, token: "series:prazsky_mtb" },
  { re: /\bcesky\s*pohar\s*mtb|český\s*pohár\s*mtb|poharmtb/i, token: "series:cesky_pohar_mtb" },
  { re: /\buci\s*mtb\s*world\s*(cup|series)\b/i, token: "series:uci_mtb_ws" },
  { re: /\bd[eě]tsk[yý]\s*mtb\s*cup\b/i, token: "series:detsky_mtb_cup" },
  {
    re: /\bvelk[yý]\s*h[aá]j\b|\bpohar\s*m[cč]\s*praha\s*4\b/i,
    token: "series:pohar_praha_4",
  },
  {
    re: /\bppkbike\b|\bpohar\s*plzenskeho\s*kraje\b/i,
    token: "series:ppkbike",
  },
  { re: /\bpohar\s*kv\s*kraje\b/i, token: "series:pohar_kv_hk" },
  { re: /\bdetska\s*tour(\s*petra\s*sagana)?\b|\bdtps\b/i, token: "series:dtps" },
  { re: /\balb-?gold\s*juniors/i, token: "series:alb_gold" },
  { re: /\brookies\s*cup\s*ostbayern\b/i, token: "series:rookies_ostbayern" },
  { re: /\bxco-?bikecup\b/i, token: "series:xco_bikecup" },
  { re: /\bjunior\s*bike\s*cup\b/i, token: "series:junior_bike_cup" },
  { re: /\bon-off\s*mtb/i, token: "series:on_off_mtb" },
  { re: /\bpoland\s*bike\b/i, token: "series:poland_bike" },
  { re: /\bsalzkammergut\s*trophy\b/i, token: "series:skg_trophy" },
  { re: /\bpeklo\s*severu\b/i, token: "series:peklo_severu" },
  { re: /\bsport\s*challenge\b/i, token: "series:sport_challenge" },
  { re: /\bsumavsk[yý]\s*(mtb\s*)?pohar\b|\bšumavsk[yý]\s*(mtb\s*)?pohár\b/i, token: "series:sumavsky" },
  { re: /\bbayerwald\s*mtb\s*cup\b/i, token: "series:bayerwald" },
  { re: /\bwerdenfels/i, token: "series:werdenfels" },
  { re: /\bpodkrkonossk[yý]\s*maraton\b|\bpodkrkonošsk[yý]\s*maraton\b/i, token: "series:podkrkonossky" },
  { re: /\brhein-main\s*cup\b/i, token: "series:rhein_main" },
  { re: /\beldorado\s*kids/i, token: "series:eldorado_kids" },
  { re: /\bktm\s*junior\s*challenge\b/i, token: "series:ktm_junior" },
  { re: /\bdetska\s*vrl\b|\bvrl\s*adriana\s*babica/i, token: "series:detska_vrl" },
  { re: /\bberg\s*&\s*bike\b|\bmpdv\s*(mountainbike\s*)?cup\b/i, token: "series:berg_bike" },
  { re: /\bwiesbadener\s*stadtmeisterschaft\b/i, token: "series:wiesbaden_stadt" },
  { re: /\ballga[eu]er\s*alpenwasser\b/i, token: "series:allgaeu_kids" },
  { re: /\bzanzenberg\b/i, token: "series:zanzenberg" },
  { re: /\bglobmetal\b/i, token: "series:globmetal" },
  { re: /\b(skoda\s*)?swiss\s*bike\s*cup\b/i, token: "series:skoda_swiss_bike" },
  { re: /\bvittoria(-fischer)?\b/i, token: "series:vittoria_fischer" },
  { re: /\bkids\s*bike\s*cup\s*valais\b|\bvalais\/wallis\b/i, token: "series:valais_kids" },
  { re: /\bvaliant\s*gp\b/i, token: "series:valiant_gp" },
  { re: /\bbike\s*kingdom\b/i, token: "series:bike_kingdom" },
  { re: /\bbundicycling\b/i, token: "series:bundi_kids" },
  { re: /\beiger\s*bike.*kids\b|\bkids\s*race.*eiger\b/i, token: "series:eiger_kids" },
  { re: /\beiger\s*bike\s*challenge\b/i, token: "series:eiger_adult" },
  { re: /\bkids\s*bike\s*trophy\b/i, token: "series:kids_bike_trophy" },
  { re: /\bxco-nrw\b|\bschuler[\s-]*cup\b|\bschüler[\s-]*cup\b/i, token: "series:xco_nrw" },
  { re: /\brena\s*kids\b/i, token: "series:rena_kids" },
  { re: /\bsparkassen[\s-]*kids\b/i, token: "series:albstadt_kids" },
  { re: /\bstoakart\b/i, token: "series:stoakart" },
  { re: /\bjarni\s*bahno\b|\bbahno\b/i, token: "series:bahno" },
  { re: /\bbike\s*revolution\b/i, token: "series:bike_revolution" },
  { re: /\bbikeside\b/i, token: "series:bikeside" },
  { re: /\bcopa\s*madrid\b/i, token: "series:copa_madrid" },
  { re: /\blillelunds\b/i, token: "series:lillelunds" },
  { re: /\bmtb\s*race\s*series\b/i, token: "series:mtb_race_series" },
  { re: /\bmarathon[\s-]*man\b/i, token: "series:marathon_man" },
  { re: /\bkr[aá]l\s+[sš]umavy\b/i, token: "series:kral_sumavy" },
  { re: /\bmalevil\b/i, token: "series:malevil" },
  { re: /\bhoral\b/i, token: "series:horal" },
  { re: /\bnationalpark\s*bike\b/i, token: "series:np_bike" },
  { re: /\bgrand\s*raid\b/i, token: "series:grand_raid" },
  { re: /\bevol[eé]nard\s*fmv\b/i, token: "series:evolenard_fmv" },
  { re: /\bpomerania\b/i, token: "series:pomerania" },
  { re: /\bsilesia\s*bike\b/i, token: "series:silesia_bike" },
  { re: /\bhero\s*(s[uü]dtirol|dolomites)\b/i, token: "series:hero_dolomites" },
  { re: /\btroi\s*trek\b/i, token: "series:troi_trek" },
  { re: /\bsloenduro\b/i, token: "series:sloenduro" },
  { re: /\b3\s*nations\s*cup\b/i, token: "series:3_nations" },
  { re: /\bitalia\s*bike\s*cup\s*young\b/i, token: "series:ibc_young" },
  { re: /\bitalia\s*bike\s*cup(?!\s*young)\b/i, token: "series:ibc" },
  { re: /\bcoppa\s*italia\s*giovanile\b/i, token: "series:cig_mtb" },
  { re: /\bcopa\s*catalana\s*internacional\b/i, token: "series:copa_cat_int" },
  { re: /\bcopa\s*catalunya\s*btt\b/i, token: "series:copa_cat_btt" },
  { re: /\bcopa\s*de\s*espa[nñ]a\s*xcm\b/i, token: "series:copa_es_xcm" },
  { re: /\bcopa\s*de\s*espa[nñ]a\s*enduro\b/i, token: "series:copa_es_enduro" },
  { re: /\bcopa\s*de\s*espa[nñ]a\s*(dh|descenso)\b/i, token: "series:copa_es_dh" },
  { re: /\bcroatia\s*mtb\s*xco\s*cup\b|\bmtb\s*croatia\s*cup\b/i, token: "series:croatia_xco" },
  { re: /\bkultainen\s*kampi\b/i, token: "series:kampi" },
  { re: /\b4\s*islands\s*epic\b/i, token: "series:4_islands" },
  { re: /\bmtb\s*kids\s*series\b|\bvlaanderen\s*mtb\s*kids\b/i, token: "series:vl_kids" },
  { re: /\bmtb\s*xco\s*series\b|\bvlaanderen\s*mtb\s*xco\b/i, token: "series:vl_xco" },
  { re: /\boost-nederland\b|\bmtb\s*cup\s*oost\b/i, token: "series:oost_nl" },
  { re: /\bstreetrace\b/i, token: "series:streetrace" },
  { re: /\bnk\s*mountainbike\b/i, token: "series:nk_mtb" },
  { re: /\bsloxcup\b|\bslo\s*x[\s-]*cup\b/i, token: "series:sloxcup" },
  {
    re: /\bslovenia\s*downhill\b|\bslovenija\s*downhill\b/i,
    token: "series:slovenia_dh",
  },
  { re: /\bmb\s*race\b/i, token: "series:mb_race" },
  { re: /\btransmaurienne\b/i, token: "series:transmaurienne" },
  { re: /\broc\s*d['’]?azur\b/i, token: "series:roc_azur" },
  { re: /\brye\s*bike\b/i, token: "series:rye_bike" },
  { re: /\bcrosskov[aá]csi\b/i, token: "series:crosskovacsi" },
  { re: /\balpentour\b/i, token: "series:alpentour" },
  { re: /\b(la\s*)?rioja\s*bike\b/i, token: "series:rioja_bike" },
  { re: /\b(telenet\s*)?superprestige\b/i, token: "series:superprestige" },
  { re: /\buci\s*cyclo-?cross\s*world\s*cup\b|\bcyclo-?cross\s*world\s*cup\b/i, token: "series:uci_cx_wc" },
  { re: /\buec\b/i, token: "series:uec" },
  { re: /\bworld\s*cup\b|\bswc\b|\bcdm\b/i, token: "series:world_cup" },
];

const NOISE_WORDS =
  /\b(zavod|race|open|memorial|memoria|uci|c1|c2|c3|hc|xco|xcc|xcm|dh|enduro|gravel|road|mtb|cx|bmx|elite|junior|u23|masters|kids|deti|mladez|vpace)\b/gi;

/** Sponsor / marketing fluff that differs between official and calendar titles. */
const SPONSOR_NOISE =
  /\b(skoda\s*auto|škoda\s*auto|direct|ozp|galaxy|ceska\s*sporitelna|ceska\s*sporitelna|generali|uniqa|kooperativa|slavia|tipsport)\b/gi;

/** Calendar roots that must not count as “same URL”. */
const GENERIC_HOST_PATH =
  /^(hynekmusil\.cz|sumator\.cz|mtbs\.cz|radsport-events\.de|eventivsport\.com|velokal\.de|jiskra\.potocky\.cz|jihoceskymtbpohar\.cz|maraton\.cz|mso\.swiss)(\/(kalendar|sekce\/kalendar|map|race\/?|terminovka)?)?$/i;

/** Series calendars / hub pages — shared by every round, never identity. */
const CALENDAR_URL_PATH =
  /kidscup\.bike\/(en\/)?(race-calendar|rennkalender)|rookiescup\.bike\/(en\/)?(race-calendar|rennkalender)|ixsdownhillcup\.com\/(en\/)?(race-calendar|rennkalender)|cup\.cube\.eu\/?(anmeldung)?\/?$|kolopro\.cz\/zavody\/?$|juniorcup\.net\/?$|iprimacup\.cz\/zavody-20\d{2}|poharmtb\.cz\/(cross-country|enduro|downhill)|zapadoceskaamaterskaliga\.cz\/kalendare|prahamtb\.cz|enduroserie\.cz\/zavody|enduro\.sportsoft\.cz|cyklokros\.cz\/kalendar|ucimtbworldseries\.com\/calendar|swiss-cycling\.ch\/.*kalender|cyclingaustria\.at\/kalender|detskymtbcup\.cz\/?$|skvelopraha\.cz\/velky-haj|ppkbike\.cz|ppk-hk\.cz|cyklistikaszc\.sk\/.*kalendar|albgold-juniorscup\.de|rookiescup-ostbayern\.de\/rennen|xco-bikecup\.de|schwarzwaelder-mtb-cup\.de|rhein-eifel-mtb-cup\.de|mtb-oberschwaben-cup\.de|mtbsaarlandliga\.de\/rennen|juniorbikecup\.at\/termine|polandbike\.pl\/kalendarz|salzkammergut-trophy\.at|pekloseveru\.cz\/(cz\/)?registrace|pekloseveru\.cz\/en\/registration|pekloseveru\.cz\/.*propozice-serialu|pekloseveru\.cz\/.*series-regulations|ustimtbcup\.cz\/?$|jcp-mtb\.cz\/?$|bayerwald-mtb-cup\.com\/?$|skiclub-bb\.com\/werdenfelscup|mtb-rhein-main-cup\.de\/?$|mtb-kidscup\.de\/start\/termine-2|mountainbike-challenge\.at\/?$|soof\.sk\/podujatia-a-akcie|mpdv-cup\.de\/?$|swissbikecup\.ch(\/(en|de|fr))?\/?$|mtb-cup\.ch\/(en\/)?race\/?$|valais-cycling\.ch\/.*kids-bike-cup-valais|bikekingdom\.ch\/.*kids-cup|eigerbike\.ch\/.*kids-race|eigerbike\.ch\/.*race\/informations|marathon-man\.eu\/?$|mtbpomerania\.pl\/?$|silesia\.bike\/?$|sloenduro\.com\/.*sloenduro-calendar|sloxcup\.com\/dirke-2026|sloveniadownhillcup\.si\/(en\/)?(races|dirke)-2026|belgiancycling\.be\/.*3-nations-cup\/kalender|cycling\.vlaanderen\/competitie\/mtb\/(xco|kids)-series|mtbcompetitieoostnederland\.nl\/.*agenda-mbt-cup|knwu\.nl\/kampioenschappen\/nk-mountainbike|knwu\.nl\/nieuws\/klaar-voor-mtb-streetrace|federciclismo\.it\/.*circuiti-mtb\/(italia-bike-cup|coppa-italia-giovanile)|ciclisme\.cat\/campionat\/btt\/copa-catal|hbs\.hr\/kalendar|pyoraily\.fi\/.*kultainen-kampi|esmtb\.com\/calendario-de-las-copas-de-espana|bikeclub-engelberg\.ch\/wp\/valiant-gp|brvinfo\.ch\/bundicycling-kidscup|xco-nrw-cup\.de\/?$|schwarzwald-bike-marathon\.de\/.*rena-kids-cup|albstadt-bike-marathon\.de\/?$|rsv-bad-griesbach\.de\/?$|bahno\.ambike\.com\/?$|mtbraceseries\.ch\/egg|bikeside\.ch(\/kategorien)?\/?$|fmciclismo\.com\/.*ESCUELAS|superprestigecyclocross\.be\/.+\/kalender\/?$|ucicyclocrossworldcup\.com\/.+\/calendar\/?$|uec\.ch\/.+\/calendar|detskatour\.sk\/?$|lines-mag\.at\/austrian-gravity-series\/?$|raceresult\.com\/events\/?$|mtb-bundesliga\.net\/(rennen\/)?$|mtb-bundesliga\.net\/nachwuchs-bl|polandbike\.pl\/junior-race|kalendar\.sportsoft\.cz\/?$|pucharmtb\.pl\/kalendarz|czechcyclingfederation\.com\/(en\/)?events\/(mnd-cup|skoda-cup)|cyclingaustria\.at\/news\/.*cycling-austria-cups|sport-base\.eu\/competitions\/?$/i;

/** Leading locale segment: /en/race, /de/rennen, /cs/zavod — same page, other language. */
const LOCALE_SEGMENT =
  /^\/(en|de|cs|cz|sk|pl|fr|it|es|nl|hu|hr|sl|si|ru|uk|at|ch|dk|fi|no|se|pt|ro|bg|gr|el|tr|eng|deu|ger)(?:-[a-z]{2})?(?=\/|$)/i;

/** Directory-index leaves that carry no identity. */
const INDEX_LEAF = /\/(index|default|home)\.(html?|php|aspx?)$/i;

/** Same page reached in another language / via a directory index → one identity. */
function canonicalPath(path: string): string {
  let p = path.replace(INDEX_LEAF, "");
  // Locales can be nested (/en/de/ never happens, but /en//race does) — loop once.
  const stripped = p.replace(LOCALE_SEGMENT, "");
  if (stripped !== p) p = stripped;
  return p.replace(/\/+/g, "/").replace(/\/+$/, "");
}

/**
 * Strip tracking noise; hostname + pathname only.
 * Returns empty string for unusable / generic calendar URLs.
 */
export function normalizeUrlForDedup(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "") || "";
    // Drop empty or root-only aggregators
    const key = `${host}${path}`.toLowerCase();
    if (GENERIC_HOST_PATH.test(key) || GENERIC_HOST_PATH.test(host)) return "";
    if (CALENDAR_URL_PATH.test(key)) return "";
    // Bare domain with no meaningful path → ignore
    if (!path || path === "/") return "";
    // Language-neutral identity, but only after the calendar filters have seen
    // the original path — the hub patterns are written with locale prefixes.
    const slimPath = canonicalPath(path);
    const slimKey = `${host}${slimPath}`.toLowerCase();
    if (slimKey !== key) {
      if (GENERIC_HOST_PATH.test(slimKey) || CALENDAR_URL_PATH.test(slimKey)) return "";
      if (!slimPath || slimPath === "/") return "";
    }
    const sportsoftEvent = host.endsWith("sportsoft.cz") ? u.searchParams.get("e") : null;
    if (host.endsWith("sportsoft.cz") && /startreg\.aspx$/i.test(path) && !sportsoftEvent) {
      return "";
    }
    const radBlEvent = host.endsWith("rad-bundesliga.net")
      ? u.searchParams.get("event_id")
      : null;
    if (host.endsWith("rad-bundesliga.net")) {
      return radBlEvent ? `${host}?event_id=${radBlEvent}` : "";
    }
    return sportsoftEvent ? `${slimKey}?e=${sportsoftEvent}` : slimKey;
  } catch {
    return "";
  }
}

export function urlsOverlap(
  a: (string | null | undefined)[] | undefined,
  b: (string | null | undefined)[] | undefined,
): boolean {
  const A = new Set((a ?? []).map(normalizeUrlForDedup).filter(Boolean));
  if (!A.size) return false;
  for (const u of b ?? []) {
    const n = normalizeUrlForDedup(u);
    if (n && A.has(n)) return true;
  }
  return false;
}

/**
 * Identity string for dedup: aliases expanded, round numbers / class-only noise stripped,
 * but series + place tokens kept (unlike normalizeName which drops cp/cup/mtb).
 */
export function canonicalizeForDedup(name: string): string {
  let s = fold(name);
  const aliasHits: string[] = [];
  for (const rule of SERIES_ALIAS_RULES) {
    if (rule.re.test(s)) {
      aliasHits.push(rule.token);
      s = s.replace(rule.re, " ");
    }
  }
  s = s
    .replace(/\b\d{1,2}\.\s*/g, " ")
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/\b\d{1,2}\s*[-–/]\s*\d{1,2}\s*\/\s*\d{1,2}\b/g, " ")
    .replace(SPONSOR_NOISE, " ")
    .replace(NOISE_WORDS, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...aliasHits, s].filter(Boolean).join(" ").trim();
}

export function seriesAliasTokens(name: string): string[] {
  const s = fold(name);
  return SERIES_ALIAS_RULES.filter((r) => r.re.test(s)).map((r) => r.token);
}

/** Titles that are basically just a UCI class / empty after cleaning. */
export function isWeakRaceName(name: string): boolean {
  const folded = fold(name)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!folded || folded.length < 4) return true;
  if (/^(uci\s*)?(hc|c[1-3]|cdm)$/i.test(folded)) return true;
  if (/^(uci\s*c[1-3]|uci\s*hc)$/i.test(folded)) return true;
  if (/^(uci mtb world cup|nmnm|vimperk|bedrichov)$/.test(folded)) return true;
  const canon = canonicalizeForDedup(name);
  return !canon || canon.length < 3;
}

/** Dice coefficient on character bigrams */
export function nameSimilarity(a: string, b: string): number {
  const x = canonicalizeForDedup(a) || normalizeName(a);
  const y = canonicalizeForDedup(b) || normalizeName(b);
  return dice(x, y);
}

function dice(x: string, y: string): number {
  if (!x || !y) return 0;
  if (x === y) return 1;
  const bigrams = (s: string) => {
    const out: string[] = [];
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  };
  const A = bigrams(x);
  const B = bigrams(y);
  if (!A.length || !B.length) return 0;
  let inter = 0;
  const pool = [...B];
  for (const g of A) {
    const i = pool.indexOf(g);
    if (i >= 0) {
      inter += 1;
      pool.splice(i, 1);
    }
  }
  return (2 * inter) / (A.length + B.length);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function placeTokens(...places: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const p of places) {
    if (!p) continue;
    for (const w of fold(p)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4)) {
      out.add(w);
    }
  }
  return [...out];
}

const VENUE_FORMAT_WORDS =
  /\b(cyklokros|cyclocross|\bcx\b|gravel|maraton|marathon|xco|xcm|xcc|enduro|downhill|\bdh\b|silnic|road|mtb|casovka|casovka)\b/i;

function titlePlaceWords(name: string): string[] {
  return canonicalizeForDedup(name)
    .split(/\s+/)
    .filter((w) => !w.startsWith("series:"));
}

function isPlaceOnlyTitle(name: string, placeText?: string | null): boolean {
  const words = titlePlaceWords(name);
  if (!words.length) return isWeakRaceName(name);
  const ptoks = placeTokens(placeText, name);
  return words.every((w) => ptoks.some((t) => t.includes(w) || w.includes(t)));
}

function hasVenueFormatHint(ev: DedupEvent): boolean {
  const blob = `${ev.name} ${ev.seriesName ?? ""}`;
  if (VENUE_FORMAT_WORDS.test(fold(blob))) return true;
  return seriesAliasTokens(blob).some((t) => t.includes("cx") || t.includes("cyclo"));
}

function sharedPlaceTitleToken(a: DedupEvent, b: DedupEvent): string | null {
  const venueTokens = placeTokens(a.placeText, b.placeText);
  if (!venueTokens.length) return null;
  const wordsA = titlePlaceWords(a.name);
  const wordsB = titlePlaceWords(b.name);
  for (const t of venueTokens) {
    const inA = wordsA.some((w) => w.includes(t) || t.includes(w));
    const inB = wordsB.some((w) => w.includes(t) || t.includes(w));
    if (inA && inB) return t;
  }
  return null;
}

/** Canonical title with venue words stripped so "Blovice - DÚŠA KAP" ≈ "5. TalentCUP: DÚŠA KAP". */
function coreCanonical(ev: DedupEvent, other: DedupEvent): string {
  let s = fold(ev.name);
  for (const tok of placeTokens(ev.placeText, other.placeText)) {
    s = s.replace(new RegExp(`\\b${escapeRe(tok)}\\b`, "g"), " ");
  }
  const blob = ev.seriesName ? `${s} ${fold(ev.seriesName)}` : s;
  return canonicalizeForDedup(blob);
}

function parseDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

export function daysBetween(a: string, b: string): number {
  return Math.abs(parseDay(a) - parseDay(b));
}

type DateSpan = { startDate: string; endDate?: string | null };

/** Intervals touch or gap ≤ maxGap days (covers Sat+Sun multi-day cups). */
export function datesCompatible(a: DateSpan, b: DateSpan, maxGap = 1): boolean {
  const a0 = parseDay(a.startDate);
  const a1 = parseDay(a.endDate || a.startDate);
  const b0 = parseDay(b.startDate);
  const b1 = parseDay(b.endDate || b.startDate);
  const lo = Math.min(a0, a1);
  const hi = Math.max(a0, a1);
  const lo2 = Math.min(b0, b1);
  const hi2 = Math.max(b0, b1);
  if (hi < lo2) return lo2 - hi <= maxGap;
  if (hi2 < lo) return lo - hi2 <= maxGap;
  return true;
}

export function isGarbagePlace(place?: string | null): boolean {
  const p = fold(place || "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (
    !p ||
    /^(uci\s*(c[123]|cn|hc)|unknown|silnice)$/.test(p) ||
    /^(czechia|czech republic|cesko|ceska republika|poland|polsko|slovakia|slovensko|austria|rakousko|germany|nemecko|italy|italie|hungary|madarsko)$/.test(
      p,
    )
  );
}

export function placesNearby(
  a: { lat?: number | null; lng?: number | null; placeText?: string | null },
  b: { lat?: number | null; lng?: number | null; placeText?: string | null },
  maxKm = 25,
): boolean {
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    return distanceKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) <= maxKm;
  }
  const pa = fold(a.placeText || "").replace(/[^a-z0-9\s]/g, " ").trim();
  const pb = fold(b.placeText || "").replace(/[^a-z0-9\s]/g, " ").trim();
  if (!pa || !pb || isGarbagePlace(pa) || isGarbagePlace(pb)) return false;
  const ta = pa.split(/\s+/).filter((w) => w.length >= 4);
  const tb = pb.split(/\s+/).filter((w) => w.length >= 4);
  return ta.some((w) => pb.includes(w)) || tb.some((w) => pa.includes(w));
}

export type DedupEvent = {
  startDate: string;
  endDate?: string | null;
  name: string;
  lat?: number | null;
  lng?: number | null;
  placeText?: string | null;
  seriesName?: string | null;
  fingerprint?: string;
  /** website / registration / race-detail source URLs (not calendar roots) */
  urls?: (string | null | undefined)[];
};

export type DedupScore = {
  score: number;
  reasons: string[];
};

/**
 * Multi-signal score. Signals: fingerprint, URL, date, place, name/alias.
 * Merge when score ≥ {@link DEDUP_THRESHOLD}.
 */
export const DEDUP_THRESHOLD = 50;

export function scoreDuplicate(a: DedupEvent, b: DedupEvent): DedupScore {
  const reasons: string[] = [];
  let score = 0;

  if (a.fingerprint && b.fingerprint && a.fingerprint === b.fingerprint) {
    return { score: 100, reasons: ["fingerprint"] };
  }

  const sameUrl = urlsOverlap(a.urls, b.urls);
  const datesOk = datesCompatible(a, b, 1);
  const sameDay = a.startDate.slice(0, 10) === b.startDate.slice(0, 10);
  let near = placesNearby(a, b);
  const ca = coreCanonical(a, b);
  const cb = coreCanonical(b, a);
  const sim = Math.max(nameSimilarity(a.name, b.name), dice(ca, cb));
  const aliasesA = seriesAliasTokens(`${a.name} ${a.seriesName ?? ""}`);
  const aliasesB = seriesAliasTokens(`${b.name} ${b.seriesName ?? ""}`);
  const sharedAlias = aliasesA.some((t) => aliasesB.includes(t));
  const weakA = isWeakRaceName(a.name);
  const weakB = isWeakRaceName(b.name);

  // Distinct formats at the same venue/weekend (XCO vs biatlon, DH vs XCM, …)
  if (!sameUrl && formatConflict(a.name, b.name)) {
    return { score: 0, reasons: ["format_conflict"] };
  }

  // Women's race vs open/men's race the same day (UMAG/Poreč Classic)
  if (!sameUrl && genderConflict(a.name, b.name)) {
    return { score: 0, reasons: ["gender_conflict"] };
  }

  // Distinct named series at the same venue (Kids Cup vs iXS DHC, AYC vs MLA, …)
  if (aliasesA.length && aliasesB.length && !sharedAlias) {
    return { score: 0, reasons: ["series_conflict"] };
  }

  if (
    !near &&
    datesOk &&
    (isGarbagePlace(a.placeText) || isGarbagePlace(b.placeText)) &&
    (sharedAlias || sim >= 0.55 || weakA || weakB)
  ) {
    near = true;
    reasons.push("place_unknown_same_weekend");
  }

  // --- URL (strong, but still need plausible dates for multi-year reuse of pages)
  if (sameUrl) {
    score += 45;
    reasons.push("same_url");
    if (datesOk) {
      score += 20;
      reasons.push("dates_ok");
    } else if (daysBetween(a.startDate, b.startDate) <= 3) {
      score += 10;
      reasons.push("dates_near");
    }
  }

  // --- Date
  if (!sameUrl) {
    if (!datesOk) {
      return { score: 0, reasons: ["dates_too_far"] };
    }
    score += sameDay ? 18 : 12;
    reasons.push(sameDay ? "same_day" : "weekend");
  } else if (datesOk && !reasons.includes("dates_ok")) {
    score += 12;
    reasons.push("dates_ok");
  }

  // --- Place
  if (near) {
    score += 22;
    reasons.push("same_place");
  }

  // --- Name / series
  if (ca && cb && ca === cb) {
    score += 28;
    reasons.push("same_canonical_name");
  } else {
    if (sharedAlias && near && sameDay) {
      // Same series + venue + day (Hynek listing vs official calendar).
      // Consecutive cup rounds share branding — do not merge across the weekend.
      score += 24;
      reasons.push("series_alias");
    } else if (sharedAlias && near && datesOk) {
      // Multi-day listing (Fri–Sat) vs Sunday-only mirror of the same race.
      score += 16;
      reasons.push("series_alias");
    } else if (sharedAlias) {
      score += 8;
      reasons.push("series_alias_weak");
    }

    // Always record similarity for merge gates — series_alias must not hide it.
    if (sim >= 0.88) {
      if (!reasons.includes("series_alias")) score += 26;
      else score += 4;
      reasons.push("name_sim_high");
    } else if (sim >= 0.55) {
      if (!reasons.includes("series_alias") && !reasons.includes("series_alias_weak")) {
        score += 14;
      } else {
        score += 4;
      }
      reasons.push("name_sim_mid");
    } else if (sim >= 0.35) {
      if (!reasons.includes("series_alias") && !reasons.includes("series_alias_weak")) {
        score += 6;
      }
      reasons.push("name_sim_low");
    }
  }

  // Weak title ("UCI C1") absorbed into richer title at same place/weekend
  if (near && datesOk && (weakA || weakB)) {
    const strong = fold(weakA ? b.name : a.name);
    const weak = fold(weakA ? a.name : b.name);
    if (
      strong.includes(weak) ||
      (/uci\s*c[1-3]|uci\s*hc/.test(strong) && /uci\s*c[1-3]|uci\s*hc/.test(weak))
    ) {
      score += 18;
      reasons.push("weak_name_absorbed");
    }
  }

  // Place-only title vs "Cyklokros Litvínovice" / "TBC — Litvínovice" at same venue
  if (near && sameDay && !reasons.includes("same_canonical_name")) {
    const placeTok = sharedPlaceTitleToken(a, b);
    if (placeTok) {
      const placeOnlyA = isPlaceOnlyTitle(a.name, a.placeText);
      const placeOnlyB = isPlaceOnlyTitle(b.name, b.placeText);
      const formatA = hasVenueFormatHint(a);
      const formatB = hasVenueFormatHint(b);
      if ((placeOnlyA && formatB) || (placeOnlyB && formatA)) {
        score += 14;
        reasons.push("venue_format_mirror");
      }
    }
  }

  // Substring fallback
  const na = normalizeName(a.name);
  const nb = normalizeName(b.name);
  if (
    near &&
    na &&
    nb &&
    (na.includes(nb) || nb.includes(na)) &&
    Math.min(na.length, nb.length) >= 6 &&
    !reasons.includes("same_canonical_name")
  ) {
    score += 10;
    reasons.push("name_substring");
  }

  // Name-only matches without place/URL are too risky
  if (!near && !sameUrl && score < 70) {
    score = Math.min(score, DEDUP_THRESHOLD - 1);
    reasons.push("needs_place_or_url");
  }

  return { score, reasons };
}

export function isLikelyDuplicate(a: DedupEvent, b: DedupEvent): boolean {
  return scoreDuplicate(a, b).score >= DEDUP_THRESHOLD;
}

/**
 * Highest-scoring duplicate among candidates, or null.
 *
 * Taking the *best* match instead of the first one above the threshold matters:
 * when a new listing weakly matches an old row while a better row exists, the
 * first-match behaviour welds it to the wrong event and leaves the good pair
 * behind as a permanent duplicate.
 */
export function pickBestDuplicate<T>(
  incoming: DedupEvent,
  candidates: { row: T; event: DedupEvent }[],
): { row: T; score: number; reasons: string[] } | null {
  let best: { row: T; score: number; reasons: string[] } | null = null;
  for (const c of candidates) {
    const { score, reasons } = scoreDuplicate(incoming, c.event);
    if (score < DEDUP_THRESHOLD) continue;
    if (!best || score > best.score) best = { row: c.row, score, reasons };
  }
  return best;
}

/** Every ISO day an event occupies, capped so broken end_dates cannot explode. */
export function spanDays(span: DateSpan, maxDays = 12): string[] {
  const start = parseDay(span.startDate);
  const end = parseDay(span.endDate || span.startDate);
  const lo = Math.min(start, end);
  const hi = Math.min(Math.max(start, end), lo + maxDays - 1);
  const out: string[] = [];
  for (let d = lo; d <= hi; d++) {
    out.push(new Date(d * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

/** Conflicting race-format tokens → not the same event even at one venue. */
const FORMAT_TOKENS = [
  "biatlon",
  "xco",
  "xcm",
  "xcc",
  "dh",
  "downhill",
  "enduro",
  "gravel",
  "cyclo",
  "casovka",
  "časovka",
  "eliminator",
  "eliminátor",
  "short track",
  "maraton",
] as const;

export function formatConflict(aName: string, bName: string): boolean {
  const fa = fold(aName);
  const fb = fold(bName);
  const ta = FORMAT_TOKENS.filter((t) => fa.includes(fold(t)));
  const tb = FORMAT_TOKENS.filter((t) => fb.includes(fold(t)));
  if (!ta.length || !tb.length) return false;
  return !ta.some((t) => tb.includes(t));
}

function genderConflict(aName: string, bName: string): boolean {
  const lady = /\b(ladies|women|donne|žen|zeny|femminile|female)\b/i;
  return lady.test(aName) !== lady.test(bName);
}

/** Prefer a human-useful title over class-only or English stub. */
export function preferEventName(a: string, b: string): string {
  const score = (n: string) => {
    let s = n.trim().length;
    if (isWeakRaceName(n)) s -= 40;
    if (/^\d{1,2}\.\s/.test(n.trim())) s -= 35;
    if (seriesAliasTokens(n).length) s += 25;
    if (/[áčďéěíňóřšťúůýž]/i.test(n) || /\bčp\b/i.test(n)) s += 8;
    if (/\bostrava|praha|brno|plzen|liberec\b/i.test(n)) s += 10;
    return s;
  };
  return score(a) >= score(b) ? a : b;
}

export function mergeDateSpan(a: DateSpan, b: DateSpan): { startDate: string; endDate: string } {
  const dates = [a.startDate, a.endDate || a.startDate, b.startDate, b.endDate || b.startDate]
    .filter(Boolean)
    .map((d) => d!.slice(0, 10))
    .sort();
  return { startDate: dates[0], endDate: dates[dates.length - 1] };
}

/** Prefer higher race classification when merging. */
const LEVEL_RANK: Record<string, number> = {
  local: 1,
  regional: 2,
  national: 3,
  continental: 4,
  international: 5,
  world_cup: 6,
  european_championship: 7,
  world_championship: 8,
};

/**
 * Merge the stored level with a freshly classified one.
 *
 * Highest rank normally wins, because one source often knows a round is a World
 * Cup while another lists it as a local race. That is wrong in one direction:
 * a level the classifier inflated by mistake could never be corrected, since the
 * bad value always outranked the good one. Pass `bIsConfident` when the incoming
 * level came from an unambiguous marker — then it wins outright, downward too.
 */
export function preferLevel(
  a: { level?: string | null; uciClass?: string | null; classLabel?: string | null },
  b: { level?: string | null; uciClass?: string | null; classLabel?: string | null },
  bIsConfident = false,
): { level: string; uciClass: string | null; classLabel: string | null } {
  const ra = LEVEL_RANK[a.level || ""] ?? 0;
  const rb = LEVEL_RANK[b.level || ""] ?? 0;
  const winner = bIsConfident ? b : ra >= rb ? a : b;
  return {
    level: winner.level || "local",
    uciClass: a.uciClass || b.uciClass || null,
    classLabel: a.classLabel || b.classLabel || winner.classLabel || null,
  };
}
