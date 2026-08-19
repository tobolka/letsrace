import { createServerSupabase } from "@/lib/supabase/server";
import {
  boundsFromRadiusKm,
  isPlaceSearchStopword,
  resolveCoveragePlace,
} from "@/lib/coverage";
import { EUROPE_COUNTRY_CODES, isInEuropeMap, isOmittedMapCountry } from "@/lib/geo/europe";

export type GeocodeResult = {
  lat: number;
  lng: number;
  displayName?: string;
  countryCode?: string;
  bounds?: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
};

/** Common Central-European race towns — instant pins without API. */
const GAZETTEER: Record<string, { lat: number; lng: number; cc: string }> = {
  praha: { lat: 50.0755, lng: 14.4378, cc: "CZ" },
  brno: { lat: 49.1951, lng: 16.6068, cc: "CZ" },
  ostrava: { lat: 49.8209, lng: 18.2625, cc: "CZ" },
  plzen: { lat: 49.7384, lng: 13.3736, cc: "CZ" },
  "plzeň": { lat: 49.7384, lng: 13.3736, cc: "CZ" },
  liberec: { lat: 50.7663, lng: 15.0543, cc: "CZ" },
  olomouc: { lat: 49.5938, lng: 17.2509, cc: "CZ" },
  "hradec kralove": { lat: 50.2104, lng: 15.8252, cc: "CZ" },
  "hradec králové": { lat: 50.2104, lng: 15.8252, cc: "CZ" },
  pardubice: { lat: 50.0343, lng: 15.7812, cc: "CZ" },
  "ceske budejovice": { lat: 48.9745, lng: 14.4743, cc: "CZ" },
  "české budějovice": { lat: 48.9745, lng: 14.4743, cc: "CZ" },
  "karlovy vary": { lat: 50.2322, lng: 12.871, cc: "CZ" },
  zlin: { lat: 49.2264, lng: 17.666, cc: "CZ" },
  "zlín": { lat: 49.2264, lng: 17.666, cc: "CZ" },
  jihlava: { lat: 49.3961, lng: 15.5913, cc: "CZ" },
  usti: { lat: 50.6607, lng: 14.0322, cc: "CZ" },
  "usti nad labem": { lat: 50.6607, lng: 14.0322, cc: "CZ" },
  "ústí nad labem": { lat: 50.6607, lng: 14.0322, cc: "CZ" },
  most: { lat: 50.503, lng: 13.636, cc: "CZ" },
  teplice: { lat: 50.6404, lng: 13.8245, cc: "CZ" },
  "mlada boleslav": { lat: 50.4114, lng: 14.9031, cc: "CZ" },
  "mladá boleslav": { lat: 50.4114, lng: 14.9031, cc: "CZ" },
  klatovy: { lat: 49.3955, lng: 13.2951, cc: "CZ" },
  susice: { lat: 49.2311, lng: 13.5202, cc: "CZ" },
  "sušice": { lat: 49.2311, lng: 13.5202, cc: "CZ" },
  beroun: { lat: 49.9638, lng: 14.072, cc: "CZ" },
  kolin: { lat: 50.0281, lng: 15.2006, cc: "CZ" },
  "kolín": { lat: 50.0281, lng: 15.2006, cc: "CZ" },
  konarovice: { lat: 50.04139, lng: 15.28417, cc: "CZ" },
  "konárovice": { lat: 50.04139, lng: 15.28417, cc: "CZ" },
  kutna: { lat: 49.9484, lng: 15.2682, cc: "CZ" },
  "kutna hora": { lat: 49.9484, lng: 15.2682, cc: "CZ" },
  "kutná hora": { lat: 49.9484, lng: 15.2682, cc: "CZ" },
  tabor: { lat: 49.4141, lng: 14.6578, cc: "CZ" },
  "tábor": { lat: 49.4141, lng: 14.6578, cc: "CZ" },
  písek: { lat: 49.3088, lng: 14.1475, cc: "CZ" },
  pisek: { lat: 49.3088, lng: 14.1475, cc: "CZ" },
  "písek": { lat: 49.3088, lng: 14.1475, cc: "CZ" },
  jicin: { lat: 50.4372, lng: 15.3516, cc: "CZ" },
  "jičín": { lat: 50.4372, lng: 15.3516, cc: "CZ" },
  trutnov: { lat: 50.561, lng: 15.9128, cc: "CZ" },
  vrchlabi: { lat: 50.627, lng: 15.609, cc: "CZ" },
  "vrchlabí": { lat: 50.627, lng: 15.609, cc: "CZ" },
  "jablonec": { lat: 50.7244, lng: 15.1705, cc: "CZ" },
  "jablonec nad nisou": { lat: 50.7244, lng: 15.1705, cc: "CZ" },
  "semily": { lat: 50.602, lng: 15.3355, cc: "CZ" },
  turnov: { lat: 50.5836, lng: 15.1514, cc: "CZ" },
  chrudim: { lat: 49.9511, lng: 15.7956, cc: "CZ" },
  "havlickuv brod": { lat: 49.6079, lng: 15.5807, cc: "CZ" },
  "havlíčkův brod": { lat: 49.6079, lng: 15.5807, cc: "CZ" },
  "pelhrimov": { lat: 49.4313, lng: 15.2234, cc: "CZ" },
  "pelhřimov": { lat: 49.4313, lng: 15.2234, cc: "CZ" },
  trebic: { lat: 49.2149, lng: 15.8817, cc: "CZ" },
  "třebíč": { lat: 49.2149, lng: 15.8817, cc: "CZ" },
  znojmo: { lat: 48.8555, lng: 16.0488, cc: "CZ" },
  hodonin: { lat: 48.8489, lng: 17.1324, cc: "CZ" },
  "hodonín": { lat: 48.8489, lng: 17.1324, cc: "CZ" },
  "uherske hradiste": { lat: 49.0698, lng: 17.46, cc: "CZ" },
  "uherské hradiště": { lat: 49.0698, lng: 17.46, cc: "CZ" },
  "kromeriz": { lat: 49.2979, lng: 17.3931, cc: "CZ" },
  "kroměříž": { lat: 49.2979, lng: 17.3931, cc: "CZ" },
  prerov: { lat: 49.4551, lng: 17.4509, cc: "CZ" },
  "přerov": { lat: 49.4551, lng: 17.4509, cc: "CZ" },
  sumperk: { lat: 49.9653, lng: 16.9706, cc: "CZ" },
  "šumperk": { lat: 49.9653, lng: 16.9706, cc: "CZ" },
  jesenik: { lat: 50.2296, lng: 17.2047, cc: "CZ" },
  "jeseník": { lat: 50.2296, lng: 17.2047, cc: "CZ" },
  opava: { lat: 49.9387, lng: 17.9025, cc: "CZ" },
  frydek: { lat: 49.6853, lng: 18.35, cc: "CZ" },
  "frydek-mistek": { lat: 49.6853, lng: 18.35, cc: "CZ" },
  "frýdek-místek": { lat: 49.6853, lng: 18.35, cc: "CZ" },
  karvina: { lat: 49.854, lng: 18.5417, cc: "CZ" },
  "karviná": { lat: 49.854, lng: 18.5417, cc: "CZ" },
  "novy jicin": { lat: 49.5944, lng: 18.0103, cc: "CZ" },
  "nový jičín": { lat: 49.5944, lng: 18.0103, cc: "CZ" },
  "cesky tesin": { lat: 49.7461, lng: 18.623, cc: "CZ" },
  "český těšín": { lat: 49.7461, lng: 18.623, cc: "CZ" },
  blovice: { lat: 49.5823, lng: 13.5401, cc: "CZ" },
  kralovice: { lat: 49.981, lng: 13.4875, cc: "CZ" },
  utery: { lat: 49.9403, lng: 13.0794, cc: "CZ" },
  "úterý": { lat: 49.9403, lng: 13.0794, cc: "CZ" },
  litohlavy: { lat: 49.766, lng: 13.545, cc: "CZ" },
  skocice: { lat: 49.416, lng: 14.1, cc: "CZ" },
  "skočice": { lat: 49.416, lng: 14.1, cc: "CZ" },
  vesec: { lat: 50.732, lng: 15.04, cc: "CZ" },
  vinarice: { lat: 50.176, lng: 14.091, cc: "CZ" },
  "vinařice": { lat: 50.176, lng: 14.091, cc: "CZ" },
  belkovice: { lat: 49.67, lng: 17.32, cc: "CZ" },
  "bělkovice": { lat: 49.67, lng: 17.32, cc: "CZ" },
  "mala moravka": { lat: 50.021, lng: 17.315, cc: "CZ" },
  "malá morávka": { lat: 50.021, lng: 17.315, cc: "CZ" },
  peklak: { lat: 49.973, lng: 16.394, cc: "CZ" },
  "peklák": { lat: 49.973, lng: 16.394, cc: "CZ" },
  kliny: { lat: 50.638, lng: 13.548, cc: "CZ" },
  "klíny": { lat: 50.638, lng: 13.548, cc: "CZ" },
  "letiste hradcany": { lat: 50.62, lng: 14.85, cc: "CZ" },
  "letiště hradčany": { lat: 50.62, lng: 14.85, cc: "CZ" },
  kralicak: { lat: 50.124, lng: 16.847, cc: "CZ" },
  "kraličák": { lat: 50.124, lng: 16.847, cc: "CZ" },
  "teplice nad metuji": { lat: 50.589, lng: 16.17, cc: "CZ" },
  "teplice nad metují": { lat: 50.589, lng: 16.17, cc: "CZ" },
  "plzensky kraj": { lat: 49.747, lng: 13.377, cc: "CZ" },
  "plzeňský kraj": { lat: 49.747, lng: 13.377, cc: "CZ" },
  celadna: { lat: 49.55, lng: 18.34, cc: "CZ" },
  "čeladná": { lat: 49.55, lng: 18.34, cc: "CZ" },
  ralsko: { lat: 50.61, lng: 14.8, cc: "CZ" },
  "novy hradek": { lat: 50.359, lng: 16.244, cc: "CZ" },
  "nový hrádek": { lat: 50.359, lng: 16.244, cc: "CZ" },
  "kostelec nad cernymi lesy": { lat: 49.994, lng: 14.859, cc: "CZ" },
  "kostelec nad černými lesy": { lat: 49.994, lng: 14.859, cc: "CZ" },
  "lipno nad vltavou": { lat: 48.639, lng: 14.229, cc: "CZ" },
  "nove mesto na morave": { lat: 49.5615, lng: 16.0742, cc: "CZ" },
  "nové město na moravě": { lat: 49.5615, lng: 16.0742, cc: "CZ" },
  "nove mesto pod smrkem": { lat: 50.925, lng: 15.229, cc: "CZ" },
  "nové město pod smrkem": { lat: 50.925, lng: 15.229, cc: "CZ" },
  vimperk: { lat: 49.0526, lng: 13.7742, cc: "CZ" },
  prachatice: { lat: 49.0129, lng: 13.9975, cc: "CZ" },
  boskovice: { lat: 49.4875, lng: 16.66, cc: "CZ" },
  ondrejov: { lat: 49.9047, lng: 14.7842, cc: "CZ" },
  "ondřejov": { lat: 49.9047, lng: 14.7842, cc: "CZ" },
  "lysa hora": { lat: 49.546, lng: 18.447, cc: "CZ" },
  "lysá hora": { lat: 49.546, lng: 18.447, cc: "CZ" },
  rapotin: { lat: 49.977, lng: 17.016, cc: "CZ" },
  "rapotín": { lat: 49.977, lng: 17.016, cc: "CZ" },
  sedlcany: { lat: 49.6606, lng: 14.426, cc: "CZ" },
  "sedlčany": { lat: 49.6606, lng: 14.426, cc: "CZ" },
  "sadek u policky": { lat: 49.68, lng: 16.22, cc: "CZ" },
  "sádek u poličky": { lat: 49.68, lng: 16.22, cc: "CZ" },
  policka: { lat: 49.7147, lng: 16.2654, cc: "CZ" },
  "polička": { lat: 49.7147, lng: 16.2654, cc: "CZ" },
  "dalecin": { lat: 49.591, lng: 16.243, cc: "CZ" },
  "dalečín": { lat: 49.591, lng: 16.243, cc: "CZ" },
  "libice nad doubravou": { lat: 49.746, lng: 15.728, cc: "CZ" },
  "libice": { lat: 49.746, lng: 15.728, cc: "CZ" },
  kuncina: { lat: 49.8, lng: 16.63, cc: "CZ" },
  "kunčina": { lat: 49.8, lng: 16.63, cc: "CZ" },
  "cerveny kostelec": { lat: 50.476, lng: 16.093, cc: "CZ" },
  "červený kostelec": { lat: 50.476, lng: 16.093, cc: "CZ" },
  chocen: { lat: 49.9819, lng: 16.2231, cc: "CZ" },
  "choceň": { lat: 49.9819, lng: 16.2231, cc: "CZ" },
  korenov: { lat: 50.77, lng: 15.36, cc: "CZ" },
  "kořenov": { lat: 50.77, lng: 15.36, cc: "CZ" },
  "vysoke myto": { lat: 49.9532, lng: 16.1617, cc: "CZ" },
  "vysoké mýto": { lat: 49.9532, lng: 16.1617, cc: "CZ" },
  malenovice: { lat: 49.58, lng: 18.43, cc: "CZ" },
  "petrvald": { lat: 49.558, lng: 18.156, cc: "CZ" },
  "petřvald": { lat: 49.558, lng: 18.156, cc: "CZ" },
  jivova: { lat: 49.7, lng: 17.4, cc: "CZ" },
  "jívová": { lat: 49.7, lng: 17.4, cc: "CZ" },
  moravka: { lat: 49.596, lng: 18.524, cc: "CZ" },
  "morávka": { lat: 49.596, lng: 18.524, cc: "CZ" },
  otrokovice: { lat: 49.2099, lng: 17.5308, cc: "CZ" },
  malin: { lat: 49.95, lng: 15.28, cc: "CZ" },
  "malín": { lat: 49.95, lng: 15.28, cc: "CZ" },
  bratislava: { lat: 48.1486, lng: 17.1077, cc: "SK" },
  kosice: { lat: 48.7164, lng: 21.2611, cc: "SK" },
  "košice": { lat: 48.7164, lng: 21.2611, cc: "SK" },
  zilina: { lat: 49.2231, lng: 18.7394, cc: "SK" },
  "žilina": { lat: 49.2231, lng: 18.7394, cc: "SK" },
  samorin: { lat: 48.0267, lng: 17.3111, cc: "SK" },
  "šamorín": { lat: 48.0267, lng: 17.3111, cc: "SK" },
  levoca: { lat: 49.0216, lng: 20.589, cc: "SK" },
  "levoča": { lat: 49.0216, lng: 20.589, cc: "SK" },
  martin: { lat: 49.0636, lng: 18.9214, cc: "SK" },
  myjava: { lat: 48.7589, lng: 17.5674, cc: "SK" },
  nitra: { lat: 48.3064, lng: 18.0863, cc: "SK" },
  stupava: { lat: 48.275, lng: 16.996, cc: "SK" },
  sneznica: { lat: 49.261, lng: 18.761, cc: "SK" },
  "snežnica": { lat: 49.261, lng: 18.761, cc: "SK" },
  domasa: { lat: 49.005, lng: 21.75, cc: "SK" },
  "domaša": { lat: 49.005, lng: 21.75, cc: "SK" },
  mochovce: { lat: 48.271, lng: 18.437, cc: "SK" },
  donovaly: { lat: 48.877, lng: 19.229, cc: "SK" },
  bojnice: { lat: 48.78, lng: 18.588, cc: "SK" },
  demanova: { lat: 48.971, lng: 19.58, cc: "SK" },
  "demänová": { lat: 48.971, lng: 19.58, cc: "SK" },
  alsovka: { lat: 50.3059, lng: 12.946, cc: "CZ" },
  "alšovka": { lat: 50.3059, lng: 12.946, cc: "CZ" },
  wien: { lat: 48.2082, lng: 16.3738, cc: "AT" },
  vienna: { lat: 48.2082, lng: 16.3738, cc: "AT" },
  videň: { lat: 48.2082, lng: 16.3738, cc: "AT" },
  "vídeň": { lat: 48.2082, lng: 16.3738, cc: "AT" },
  dresden: { lat: 51.0504, lng: 13.7373, cc: "DE" },
  munchen: { lat: 48.1351, lng: 11.582, cc: "DE" },
  "münchen": { lat: 48.1351, lng: 11.582, cc: "DE" },
  krakow: { lat: 50.0647, lng: 19.945, cc: "PL" },
  "kraków": { lat: 50.0647, lng: 19.945, cc: "PL" },
  ejpovice: { lat: 49.743, lng: 13.51, cc: "CZ" },
  zadov: { lat: 49.1, lng: 13.63, cc: "CZ" },
  bedrichov: { lat: 50.791, lng: 15.14, cc: "CZ" },
  "bedřichov": { lat: 50.791, lng: 15.14, cc: "CZ" },
  winterberg: { lat: 51.195, lng: 8.53, cc: "DE" },
  // Frequent race towns still missing pins
  hlinsko: { lat: 49.7622, lng: 15.9075, cc: "CZ" },
  "krasna lipa": { lat: 50.9136, lng: 14.5094, cc: "CZ" },
  "krásná lípa": { lat: 50.9136, lng: 14.5094, cc: "CZ" },
  as: { lat: 50.2239, lng: 12.195, cc: "CZ" },
  "aš": { lat: 50.2239, lng: 12.195, cc: "CZ" },
  kyjov: { lat: 49.0102, lng: 17.1225, cc: "CZ" },
  "ceska kamenice": { lat: 50.7978, lng: 14.4178, cc: "CZ" },
  "česká kamenice": { lat: 50.7978, lng: 14.4178, cc: "CZ" },
  ostrov: { lat: 50.3059, lng: 12.946, cc: "CZ" },
  motol: { lat: 50.069, lng: 14.328, cc: "CZ" },
  letnany: { lat: 50.133, lng: 14.515, cc: "CZ" },
  "letňany": { lat: 50.133, lng: 14.515, cc: "CZ" },
  kbely: { lat: 50.133, lng: 14.55, cc: "CZ" },
  drasal: { lat: 49.35, lng: 14.1, cc: "CZ" }, // near Blatná / Drásov area races
  "zelezne hory": { lat: 49.85, lng: 15.75, cc: "CZ" },
  "železné hory": { lat: 49.85, lng: 15.75, cc: "CZ" },
  odry: { lat: 49.6624, lng: 17.8308, cc: "CZ" },
  "oderska mlynice": { lat: 49.66, lng: 17.83, cc: "CZ" },
  "chotebor": { lat: 49.7207, lng: 15.6702, cc: "CZ" },
  "chotěboř": { lat: 49.7207, lng: 15.6702, cc: "CZ" },
  "nova paka": { lat: 50.4944, lng: 15.5151, cc: "CZ" },
  "nová paka": { lat: 50.4944, lng: 15.5151, cc: "CZ" },
  "cesky krumlov": { lat: 48.8108, lng: 14.3152, cc: "CZ" },
  "český krumlov": { lat: 48.8108, lng: 14.3152, cc: "CZ" },
  "marianske lazne": { lat: 49.9646, lng: 12.701, cc: "CZ" },
  "mariánské lázně": { lat: 49.9646, lng: 12.701, cc: "CZ" },
  "nachod": { lat: 50.4167, lng: 16.1629, cc: "CZ" },
  "náchod": { lat: 50.4167, lng: 16.1629, cc: "CZ" },
  "rychnov": { lat: 50.1628, lng: 16.2749, cc: "CZ" },
  "rychnov nad kneznou": { lat: 50.1628, lng: 16.2749, cc: "CZ" },
  "rychnov nad kněžnou": { lat: 50.1628, lng: 16.2749, cc: "CZ" },
  "dvur kralove": { lat: 50.4317, lng: 15.814, cc: "CZ" },
  "dvůr králové": { lat: 50.4317, lng: 15.814, cc: "CZ" },
  "dvur kralove nad labem": { lat: 50.4317, lng: 15.814, cc: "CZ" },
  "litomerice": { lat: 50.5335, lng: 14.1318, cc: "CZ" },
  "litoměřice": { lat: 50.5335, lng: 14.1318, cc: "CZ" },
  "decin": { lat: 50.7822, lng: 14.2148, cc: "CZ" },
  "děčín": { lat: 50.7822, lng: 14.2148, cc: "CZ" },
  "ceska lipa": { lat: 50.6855, lng: 14.5376, cc: "CZ" },
  "česká lípa": { lat: 50.6855, lng: 14.5376, cc: "CZ" },
  "pribram": { lat: 49.6899, lng: 14.0104, cc: "CZ" },
  "příbram": { lat: 49.6899, lng: 14.0104, cc: "CZ" },
  "benešov": { lat: 49.7817, lng: 14.6869, cc: "CZ" },
  benesov: { lat: 49.7817, lng: 14.6869, cc: "CZ" },
  "rakovnik": { lat: 50.1037, lng: 13.7334, cc: "CZ" },
  "rakovník": { lat: 50.1037, lng: 13.7334, cc: "CZ" },
  "rokycany": { lat: 49.7427, lng: 13.5946, cc: "CZ" },
  "domazlice": { lat: 49.4405, lng: 12.9298, cc: "CZ" },
  "domažlice": { lat: 49.4405, lng: 12.9298, cc: "CZ" },
  "strakonice": { lat: 49.2614, lng: 13.9024, cc: "CZ" },
  "jindrichuv hradec": { lat: 49.144, lng: 15.003, cc: "CZ" },
  "jindřichův hradec": { lat: 49.144, lng: 15.003, cc: "CZ" },
  "prostejov": { lat: 49.472, lng: 17.1118, cc: "CZ" },
  "prostějov": { lat: 49.472, lng: 17.1118, cc: "CZ" },
  "vyskov": { lat: 49.2775, lng: 16.999, cc: "CZ" },
  "vyškov": { lat: 49.2775, lng: 16.999, cc: "CZ" },
  "breclav": { lat: 48.759, lng: 16.882, cc: "CZ" },
  "břeclav": { lat: 48.759, lng: 16.882, cc: "CZ" },
  "valasske mezirici": { lat: 49.4718, lng: 17.9711, cc: "CZ" },
  "valašské meziříčí": { lat: 49.4718, lng: 17.9711, cc: "CZ" },
  "vsetin": { lat: 49.3386, lng: 17.9962, cc: "CZ" },
  "vsetín": { lat: 49.3386, lng: 17.9962, cc: "CZ" },
  "koprivnice": { lat: 49.5995, lng: 18.1448, cc: "CZ" },
  "kopřivnice": { lat: 49.5995, lng: 18.1448, cc: "CZ" },
  "trinec": { lat: 49.6776, lng: 18.6708, cc: "CZ" },
  "třinec": { lat: 49.6776, lng: 18.6708, cc: "CZ" },
  "havirov": { lat: 49.7798, lng: 18.4369, cc: "CZ" },
  "havířov": { lat: 49.7798, lng: 18.4369, cc: "CZ" },
  "orlicke hory": { lat: 50.2, lng: 16.45, cc: "CZ" },
  "orlické hory": { lat: 50.2, lng: 16.45, cc: "CZ" },
  "sumava": { lat: 49.05, lng: 13.5, cc: "CZ" },
  "šumava": { lat: 49.05, lng: 13.5, cc: "CZ" },
  "beskydy": { lat: 49.5, lng: 18.4, cc: "CZ" },
  "jeseniky": { lat: 50.1, lng: 17.1, cc: "CZ" },
  "jeseníky": { lat: 50.1, lng: 17.1, cc: "CZ" },
  "krkonose": { lat: 50.74, lng: 15.74, cc: "CZ" },
  "krkonoše": { lat: 50.74, lng: 15.74, cc: "CZ" },
  vir: { lat: 49.556, lng: 16.308, cc: "CZ" },
  "vír": { lat: 49.556, lng: 16.308, cc: "CZ" },
  chodov: { lat: 50.241, lng: 12.712, cc: "CZ" },
  "veseli nad luznici": { lat: 49.184, lng: 14.697, cc: "CZ" },
  "veselí nad lužnicí": { lat: 49.184, lng: 14.697, cc: "CZ" },
  "veseli n/luznici": { lat: 49.184, lng: 14.697, cc: "CZ" },
  "veseli n/lužnicí": { lat: 49.184, lng: 14.697, cc: "CZ" },
  // Frequent UCI / foreign venues
  montreal: { lat: 45.5017, lng: -73.5673, cc: "CA" },
  "haute-savoie": { lat: 45.9, lng: 6.1, cc: "FR" },
  "haute savoie": { lat: 45.9, lng: 6.1, cc: "FR" },
  "heusden-zolder": { lat: 51.022, lng: 5.295, cc: "BE" },
  "heuden-zolder": { lat: 51.022, lng: 5.295, cc: "BE" },
  "pal arinsal": { lat: 42.572, lng: 1.484, cc: "AD" },
  arinsal: { lat: 42.572, lng: 1.484, cc: "AD" },
  "val di sole": { lat: 46.3, lng: 10.85, cc: "IT" },
  shanghai: { lat: 31.2304, lng: 121.4737, cc: "CN" },
  "nevados de chillan": { lat: -36.9, lng: -71.4, cc: "CL" },
  "nevados de chillán": { lat: -36.9, lng: -71.4, cc: "CL" },
  loudenvielle: { lat: 42.796, lng: 0.412, cc: "FR" },
  "loudenvielle-peyragudes": { lat: 42.796, lng: 0.412, cc: "FR" },
  saalfelden: { lat: 47.427, lng: 12.848, cc: "AT" },
  "saalfelden-leogang": { lat: 47.427, lng: 12.848, cc: "AT" },
  leogang: { lat: 47.44, lng: 12.76, cc: "AT" },
  "bad goisern": { lat: 47.642, lng: 13.617, cc: "AT" },
  lenzerheide: { lat: 46.728, lng: 9.558, cc: "CH" },
  rivera: { lat: 46.126, lng: 8.924, cc: "CH" },
  moleson: { lat: 46.548, lng: 7.016, cc: "CH" },
  "moleson-sur-gruyeres": { lat: 46.548, lng: 7.016, cc: "CH" },
  savognin: { lat: 46.596, lng: 9.598, cc: "CH" },
  leysin: { lat: 46.343, lng: 7.012, cc: "CH" },
  huttwil: { lat: 47.115, lng: 7.845, cc: "CH" },
  granichen: { lat: 47.359, lng: 8.103, cc: "CH" },
  chur: { lat: 46.85, lng: 9.532, cc: "CH" },
  grindelwald: { lat: 46.624, lng: 8.036, cc: "CH" },
  engelberg: { lat: 46.821, lng: 8.402, cc: "CH" },
  arbon: { lat: 47.517, lng: 9.433, cc: "CH" },
  ilanz: { lat: 46.774, lng: 9.205, cc: "CH" },
  obersaxen: { lat: 46.743, lng: 9.1, cc: "CH" },
  donat: { lat: 46.63, lng: 9.43, cc: "CH" },
  donath: { lat: 46.63, lng: 9.43, cc: "CH" },
  "crans-montana": { lat: 46.311, lng: 7.48, cc: "CH" },
  bettmeralp: { lat: 46.39, lng: 8.061, cc: "CH" },
  evolene: { lat: 46.112, lng: 7.494, cc: "CH" },
  blitzingen: { lat: 46.433, lng: 8.2, cc: "CH" },
  grimentz: { lat: 46.18, lng: 7.577, cc: "CH" },
  simplon: { lat: 46.196, lng: 8.056, cc: "CH" },
  simplondorf: { lat: 46.196, lng: 8.056, cc: "CH" },
  vercorin: { lat: 46.256, lng: 7.532, cc: "CH" },
  zinal: { lat: 46.136, lng: 7.627, cc: "CH" },
  morgins: { lat: 46.238, lng: 6.855, cc: "CH" },
  "saint-cergue": { lat: 46.446, lng: 6.157, cc: "CH" },
  "st-cergue": { lat: 46.446, lng: 6.157, cc: "CH" },
  "st. cergue": { lat: 46.446, lng: 6.157, cc: "CH" },
  lostorf: { lat: 47.384, lng: 7.9, cc: "CH" },
  hagglingen: { lat: 47.388, lng: 8.253, cc: "CH" },
  langendorf: { lat: 47.22, lng: 7.515, cc: "CH" },
  seon: { lat: 47.345, lng: 8.159, cc: "CH" },
  aesch: { lat: 47.469, lng: 7.597, cc: "CH" },
  schotz: { lat: 47.169, lng: 7.99, cc: "CH" },
  pfynwald: { lat: 46.307, lng: 7.627, cc: "CH" },
  osterhas: { lat: 47.155, lng: 7.65, cc: "CH" },
  davos: { lat: 46.803, lng: 9.837, cc: "CH" },
  einsiedeln: { lat: 47.128, lng: 8.745, cc: "CH" },
  furtwangen: { lat: 48.05, lng: 8.208, cc: "DE" },
  albstadt: { lat: 48.214, lng: 9.024, cc: "DE" },
  solingen: { lat: 51.165, lng: 7.067, cc: "DE" },
  remscheid: { lat: 51.179, lng: 7.194, cc: "DE" },
  bielstein: { lat: 50.966, lng: 7.383, cc: "DE" },
  "haltern am see": { lat: 51.743, lng: 7.181, cc: "DE" },
  haltern: { lat: 51.743, lng: 7.181, cc: "DE" },
  hurtgenwald: { lat: 50.708, lng: 6.374, cc: "DE" },
  "svaty linhart": { lat: 50.237, lng: 12.87, cc: "CZ" },
  linhart: { lat: 50.237, lng: 12.87, cc: "CZ" },
  "san martin de valdeiglesias": { lat: 40.362, lng: -4.398, cc: "ES" },
  "colmenar viejo": { lat: 40.659, lng: -3.767, cc: "ES" },
  alpedrete: { lat: 40.659, lng: -4.001, cc: "ES" },
  ciempozuelos: { lat: 40.159, lng: -3.618, cc: "ES" },
  arroyomolinos: { lat: 40.269, lng: -3.92, cc: "ES" },
  paracuellos: { lat: 40.504, lng: -3.532, cc: "ES" },
  hulst: { lat: 51.358, lng: 4.091, cc: "NL" },
  eibergen: { lat: 52.103, lng: 6.648, cc: "NL" },
  lochem: { lat: 52.161, lng: 6.411, cc: "NL" },
  nijverdal: { lat: 52.357, lng: 6.464, cc: "NL" },
  deventer: { lat: 52.255, lng: 6.163, cc: "NL" },
  markelo: { lat: 52.235, lng: 6.496, cc: "NL" },
  aalten: { lat: 51.925, lng: 6.581, cc: "NL" },
  oldenzaal: { lat: 52.313, lng: 6.929, cc: "NL" },
  winterswijk: { lat: 51.973, lng: 6.719, cc: "NL" },
  sittard: { lat: 50.998, lng: 5.869, cc: "NL" },
  wijster: { lat: 52.816, lng: 6.517, cc: "NL" },
  ruinen: { lat: 52.762, lng: 6.354, cc: "NL" },
  nijeveen: { lat: 52.733, lng: 6.312, cc: "NL" },
  ruinerwold: { lat: 52.723, lng: 6.248, cc: "NL" },
  "de wijk": { lat: 52.672, lng: 6.291, cc: "NL" },
  sleen: { lat: 52.771, lng: 6.803, cc: "NL" },
  honselersdijk: { lat: 52.007, lng: 4.224, cc: "NL" },
  rotem: { lat: 51.041, lng: 5.718, cc: "BE" },
  dessel: { lat: 51.239, lng: 5.113, cc: "BE" },
  zonhoven: { lat: 50.99, lng: 5.368, cc: "BE" },
  hamme: { lat: 51.098, lng: 4.136, cc: "BE" },
  "moerbeke-waas": { lat: 51.174, lng: 3.944, cc: "BE" },
  moerbeke: { lat: 51.174, lng: 3.944, cc: "BE" },
  langdorp: { lat: 51.007, lng: 4.869, cc: "BE" },
  genk: { lat: 50.965, lng: 5.502, cc: "BE" },
  kessel: { lat: 51.034, lng: 4.622, cc: "BE" },
  overijse: { lat: 50.774, lng: 4.535, cc: "BE" },
  ravels: { lat: 51.37, lng: 4.993, cc: "BE" },
  eupen: { lat: 50.631, lng: 6.036, cc: "BE" },
  amsterdam: { lat: 52.3676, lng: 4.9041, cc: "NL" },
  copenhagen: { lat: 55.6761, lng: 12.5683, cc: "DK" },
  kobenhavn: { lat: 55.6761, lng: 12.5683, cc: "DK" },
  brussels: { lat: 50.8503, lng: 4.3517, cc: "BE" },
  brussel: { lat: 50.8503, lng: 4.3517, cc: "BE" },
  bruxelles: { lat: 50.8503, lng: 4.3517, cc: "BE" },
  "val di fassa": { lat: 46.43, lng: 11.68, cc: "IT" },
  "la thuile": { lat: 45.714, lng: 6.913, cc: "IT" },
  albenga: { lat: 44.049, lng: 8.213, cc: "IT" },
  caneva: { lat: 45.97, lng: 12.448, cc: "IT" },
  courmayeur: { lat: 45.797, lng: 6.969, cc: "IT" },
  "rivoli veronese": { lat: 45.572, lng: 10.812, cc: "IT" },
  "la salle": { lat: 45.746, lng: 7.073, cc: "IT" },
  gorizia: { lat: 45.941, lng: 13.62, cc: "IT" },
  fumane: { lat: 45.542, lng: 10.885, cc: "IT" },
  pergine: { lat: 46.06, lng: 11.237, cc: "IT" },
  "pergine valsugana": { lat: 46.06, lng: 11.237, cc: "IT" },
  lugagnano: { lat: 44.823, lng: 9.828, cc: "IT" },
  laterza: { lat: 40.629, lng: 16.8, cc: "IT" },
  sassari: { lat: 40.725, lng: 8.556, cc: "IT" },
  petralia: { lat: 37.809, lng: 14.119, cc: "IT" },
  trivero: { lat: 45.674, lng: 8.174, cc: "IT" },
  borno: { lat: 45.946, lng: 10.199, cc: "IT" },
  banyoles: { lat: 42.119, lng: 2.767, cc: "ES" },
  "santa susanna": { lat: 41.633, lng: 2.708, cc: "ES" },
  "sant fruitos": { lat: 41.753, lng: 1.874, cc: "ES" },
  "sant fruitós": { lat: 41.753, lng: 1.874, cc: "ES" },
  "sant fruitos de bages": { lat: 41.753, lng: 1.874, cc: "ES" },
  "corro d amunt": { lat: 41.581, lng: 2.295, cc: "ES" },
  "la molina": { lat: 42.336, lng: 1.954, cc: "ES" },
  "la massana": { lat: 42.545, lng: 1.515, cc: "AD" },
  naturland: { lat: 42.545, lng: 1.515, cc: "AD" },
  "el vendrell": { lat: 41.22, lng: 1.534, cc: "ES" },
  vilajuiga: { lat: 42.325, lng: 3.092, cc: "ES" },
  "mora d ebre": { lat: 41.093, lng: 0.643, cc: "ES" },
  altafulla: { lat: 41.143, lng: 1.377, cc: "ES" },
  "fornells de la selva": { lat: 41.943, lng: 2.809, cc: "ES" },
  "la luisiana": { lat: 37.526, lng: -5.248, cc: "ES" },
  "el pedroso": { lat: 37.843, lng: -5.757, cc: "ES" },
  miajadas: { lat: 39.151, lng: -5.908, cc: "ES" },
  "jerez de los caballeros": { lat: 38.319, lng: -6.771, cc: "ES" },
  berja: { lat: 36.847, lng: -2.95, cc: "ES" },
  cuntis: { lat: 42.634, lng: -8.562, cc: "ES" },
  "orihuela del tremedal": { lat: 40.55, lng: -1.65, cc: "ES" },
  pontevedra: { lat: 42.431, lng: -8.644, cc: "ES" },
  ojen: { lat: 36.564, lng: -4.856, cc: "ES" },
  burela: { lat: 43.661, lng: -7.358, cc: "ES" },
  otivar: { lat: 36.809, lng: -3.681, cc: "ES" },
  cerler: { lat: 42.588, lng: 0.54, cc: "ES" },
  almacelles: { lat: 41.732, lng: 0.437, cc: "ES" },
  "castell d aro": { lat: 41.817, lng: 3.03, cc: "ES" },
  "les roquetes": { lat: 40.82, lng: 0.502, cc: "ES" },
  juneda: { lat: 41.549, lng: 0.825, cc: "ES" },
  "os de balaguer": { lat: 41.873, lng: 0.748, cc: "ES" },
  bitem: { lat: 40.86, lng: 0.524, cc: "ES" },
  "guejar sierra": { lat: 37.16, lng: -3.438, cc: "ES" },
  "o paramo": { lat: 42.921, lng: -7.531, cc: "ES" },
  manzaneda: { lat: 42.31, lng: -7.233, cc: "ES" },
  "valle del alberche": { lat: 40.46, lng: -4.7, cc: "ES" },
  "lake placid": { lat: 44.2795, lng: -73.9799, cc: "US" },
  "soldier hollow": { lat: 40.483, lng: -111.495, cc: "US" },
  midway: { lat: 40.512, lng: -111.474, cc: "US" },
  whistler: { lat: 50.1163, lng: -122.9574, cc: "CA" },
  "bellwald": { lat: 46.425, lng: 8.16, cc: "CH" },
  "aletch arena": { lat: 46.39, lng: 8.08, cc: "CH" },
  salzkammergut: { lat: 47.7, lng: 13.6, cc: "AT" },
  waldkirchen: { lat: 48.723, lng: 13.601, cc: "DE" },
  "nova pec": { lat: 48.775, lng: 13.925, cc: "CZ" },
  "nová pec": { lat: 48.775, lng: 13.925, cc: "CZ" },
  breitenberg: { lat: 48.704, lng: 13.61, cc: "DE" },
  "bad griesbach": { lat: 48.452, lng: 13.193, cc: "DE" },
  griesbach: { lat: 48.452, lng: 13.193, cc: "DE" },
  neureichenau: { lat: 48.749, lng: 13.747, cc: "DE" },
  passau: { lat: 48.5665, lng: 13.4312, cc: "DE" },
  buchlberg: { lat: 48.677, lng: 13.521, cc: "DE" },
  "büchlberg": { lat: 48.677, lng: 13.521, cc: "DE" },
  viechtach: { lat: 49.081, lng: 12.885, cc: "DE" },
  farchant: { lat: 47.53, lng: 11.112, cc: "DE" },
  mittenwald: { lat: 47.442, lng: 11.264, cc: "DE" },
  oberammergau: { lat: 47.597, lng: 11.067, cc: "DE" },
  benediktbeuern: { lat: 47.707, lng: 11.409, cc: "DE" },
  belohrad: { lat: 50.429, lng: 15.583, cc: "CZ" },
  "lazne belohrad": { lat: 50.429, lng: 15.583, cc: "CZ" },
  "lázně bělohrad": { lat: 50.429, lng: 15.583, cc: "CZ" },
  bensheim: { lat: 49.681, lng: 8.619, cc: "DE" },
  dexheim: { lat: 49.847, lng: 8.317, cc: "DE" },
  bauschheim: { lat: 49.967, lng: 8.394, cc: "DE" },
  darmstadt: { lat: 49.8726, lng: 8.6512, cc: "DE" },
  wiesbaden: { lat: 50.0821, lng: 8.24, cc: "DE" },
  scheffau: { lat: 47.531, lng: 12.248, cc: "AT" },
  angerberg: { lat: 47.506, lng: 12.121, cc: "AT" },
  achensee: { lat: 47.527, lng: 11.707, cc: "AT" },
  achenkirch: { lat: 47.527, lng: 11.707, cc: "AT" },
  "bad haring": { lat: 47.512, lng: 12.119, cc: "AT" },
  "bad häring": { lat: 47.512, lng: 12.119, cc: "AT" },
  inzell: { lat: 47.763, lng: 12.749, cc: "DE" },
  mieming: { lat: 47.301, lng: 10.983, cc: "AT" },
  miesbach: { lat: 47.789, lng: 11.833, cc: "DE" },
  ebbs: { lat: 47.63, lng: 12.218, cc: "AT" },
  samerberg: { lat: 47.807, lng: 12.213, cc: "DE" },
  "maria lankowitz": { lat: 47.064, lng: 15.064, cc: "AT" },
  kleinzell: { lat: 47.98, lng: 15.736, cc: "AT" },
  "kleinzell im muhlkreis": { lat: 48.457, lng: 13.991, cc: "AT" },
  "kleinzell im mühlkreis": { lat: 48.457, lng: 13.991, cc: "AT" },
  stattegg: { lat: 47.137, lng: 15.418, cc: "AT" },
  mank: { lat: 48.111, lng: 15.339, cc: "AT" },
  krumbach: { lat: 47.523, lng: 16.195, cc: "AT" },
  waibstadt: { lat: 49.297, lng: 8.918, cc: "DE" },
  langenbrand: { lat: 48.837, lng: 8.591, cc: "DE" },
  wildpoldsried: { lat: 47.767, lng: 10.4, cc: "DE" },
  dornbirn: { lat: 47.4125, lng: 9.744, cc: "AT" },
  zanzenberg: { lat: 47.4125, lng: 9.744, cc: "AT" },
  mragowo: { lat: 53.8647, lng: 21.3047, cc: "PL" },
  "mrągowo": { lat: 53.8647, lng: 21.3047, cc: "PL" },
  presov: { lat: 48.9984, lng: 21.2397, cc: "SK" },
  "prešov": { lat: 48.9984, lng: 21.2397, cc: "SK" },
  svidnik: { lat: 49.308, lng: 21.568, cc: "SK" },
  "svidník": { lat: 49.308, lng: 21.568, cc: "SK" },
  lucivna: { lat: 49.053, lng: 20.15, cc: "SK" },
  "lučivná": { lat: 49.053, lng: 20.15, cc: "SK" },
  hrabusice: { lat: 48.961, lng: 20.413, cc: "SK" },
  "hrabušice": { lat: 48.961, lng: 20.413, cc: "SK" },
  "spissky hrhov": { lat: 49.001, lng: 20.637, cc: "SK" },
  "spišský hrhov": { lat: 49.001, lng: 20.637, cc: "SK" },
  "sarisske bohdanovce": { lat: 48.97, lng: 21.247, cc: "SK" },
  "šarišské bohdanovce": { lat: 48.97, lng: 21.247, cc: "SK" },
  "spisska bela": { lat: 49.187, lng: 20.457, cc: "SK" },
  "spišská belá": { lat: 49.187, lng: 20.457, cc: "SK" },
  svit: { lat: 49.058, lng: 20.202, cc: "SK" },
  stropkov: { lat: 49.202, lng: 21.652, cc: "SK" },
  "tatranska lomnica": { lat: 49.164, lng: 20.274, cc: "SK" },
  "tatranská lomnica": { lat: 49.164, lng: 20.274, cc: "SK" },
  "uzovske peklany": { lat: 49.12, lng: 21.05, cc: "SK" },
  "uzovské pekľany": { lat: 49.12, lng: 21.05, cc: "SK" },
  gedern: { lat: 50.425, lng: 9.2, cc: "DE" },
  obergessertshausen: { lat: 48.35, lng: 10.35, cc: "DE" },
  "dolni morava": { lat: 50.122, lng: 16.8, cc: "CZ" },
  "dolní morava": { lat: 50.122, lng: 16.8, cc: "CZ" },
  "loucna nad desnou": { lat: 50.072, lng: 17.091, cc: "CZ" },
  "loučná nad desnou": { lat: 50.072, lng: 17.091, cc: "CZ" },
  sokolov: { lat: 50.1814, lng: 12.6401, cc: "CZ" },
  prosec: { lat: 49.806, lng: 16.116, cc: "CZ" },
  "proseč": { lat: 49.806, lng: 16.116, cc: "CZ" },
  zbraslavice: { lat: 49.812, lng: 15.183, cc: "CZ" },
  rymarov: { lat: 49.9318, lng: 17.2718, cc: "CZ" },
  "rýmařov": { lat: 49.9318, lng: 17.2718, cc: "CZ" },
  sazava: { lat: 49.805, lng: 14.896, cc: "CZ" },
  "sázava": { lat: 49.805, lng: 14.896, cc: "CZ" },
  bratronice: { lat: 50.116, lng: 14.016, cc: "CZ" },
  jabkenice: { lat: 50.326, lng: 15.015, cc: "CZ" },
  chynov: { lat: 49.407, lng: 14.811, cc: "CZ" },
  "chýnov": { lat: 49.407, lng: 14.811, cc: "CZ" },
  prestice: { lat: 49.573, lng: 13.333, cc: "CZ" },
  "přeštice": { lat: 49.573, lng: 13.333, cc: "CZ" },
  sezemice: { lat: 50.066, lng: 15.853, cc: "CZ" },
  harrachov: { lat: 50.772, lng: 15.431, cc: "CZ" },
  mikulov: { lat: 48.805, lng: 16.638, cc: "CZ" },
  heubach: { lat: 48.788, lng: 9.933, cc: "DE" },
  benidorm: { lat: 38.541, lng: -0.122, cc: "ES" },
  "sant julia": { lat: 42.463, lng: 1.491, cc: "AD" },
  terralba: { lat: 39.72, lng: 8.635, cc: "IT" },
  "pec pod cerchovem": { lat: 49.38, lng: 12.79, cc: "CZ" },
  "pec p cerch": { lat: 49.38, lng: 12.79, cc: "CZ" },
  rvacov: { lat: 49.82, lng: 15.88, cc: "CZ" },
  "rváčov": { lat: 49.82, lng: 15.88, cc: "CZ" },
  postrekov: { lat: 49.458, lng: 12.807, cc: "CZ" },
  "postřekov": { lat: 49.458, lng: 12.807, cc: "CZ" },
  "klasterec nad ohri": { lat: 50.3845, lng: 13.1713, cc: "CZ" },
  "klášterec nad ohří": { lat: 50.3845, lng: 13.1713, cc: "CZ" },
  "klasterec n/o": { lat: 50.3845, lng: 13.1713, cc: "CZ" },
  "hole vrchy": { lat: 50.28, lng: 14.92, cc: "CZ" },
  "holé vrchy": { lat: 50.28, lng: 14.92, cc: "CZ" },
  alber: { lat: 49.1, lng: 15.13, cc: "CZ" },
  "albeř": { lat: 49.1, lng: 15.13, cc: "CZ" },
  "nova bystrice": { lat: 49.019, lng: 15.103, cc: "CZ" },
  "nová bystřice": { lat: 49.019, lng: 15.103, cc: "CZ" },
  "roudnice nad labem": { lat: 50.4253, lng: 14.2615, cc: "CZ" },
  prestavlky: { lat: 50.4, lng: 14.28, cc: "CZ" },
  "přestavlky": { lat: 50.4, lng: 14.28, cc: "CZ" },
  "kralicky sneznik": { lat: 50.207, lng: 16.847, cc: "CZ" },
  "králický sněžník": { lat: 50.207, lng: 16.847, cc: "CZ" },
  girona: { lat: 41.9794, lng: 2.8214, cc: "ES" },
  antwerpen: { lat: 51.2194, lng: 4.4025, cc: "BE" },
  koksijde: { lat: 51.11, lng: 2.65, cc: "BE" },
  namur: { lat: 50.4674, lng: 4.872, cc: "BE" },
  gavere: { lat: 50.929, lng: 3.661, cc: "BE" },
  dendermonde: { lat: 51.029, lng: 4.101, cc: "BE" },
  "jablonne v podejstedi": { lat: 50.765, lng: 14.761, cc: "CZ" },
  jablonne: { lat: 50.765, lng: 14.761, cc: "CZ" },
  seiffen: { lat: 50.648, lng: 13.452, cc: "DE" },
  scuol: { lat: 46.8, lng: 10.297, cc: "CH" },
  zukowo: { lat: 54.342, lng: 18.348, cc: "PL" },
  kwidzyn: { lat: 53.735, lng: 18.931, cc: "PL" },
  "pruszcz gdanski": { lat: 54.262, lng: 18.634, cc: "PL" },
  gniew: { lat: 53.836, lng: 18.823, cc: "PL" },
  gniewino: { lat: 54.717, lng: 18.016, cc: "PL" },
  kartuzy: { lat: 54.334, lng: 18.201, cc: "PL" },
  gdansk: { lat: 54.352, lng: 18.646, cc: "PL" },
  barlomino: { lat: 54.7, lng: 18.08, cc: "PL" },
  psary: { lat: 50.38, lng: 19.12, cc: "PL" },
  "dabrowa gornicza": { lat: 50.322, lng: 19.187, cc: "PL" },
  czerwionka: { lat: 50.151, lng: 18.677, cc: "PL" },
  "czerwionka-leszczyny": { lat: 50.151, lng: 18.677, cc: "PL" },
  "selva di val gardena": { lat: 46.555, lng: 11.76, cc: "IT" },
  selva: { lat: 46.555, lng: 11.76, cc: "IT" },
  polcenigo: { lat: 46.038, lng: 12.503, cc: "IT" },
  "nova gorica": { lat: 45.956, lng: 13.648, cc: "SI" },
  ajdovscina: { lat: 45.889, lng: 13.91, cc: "SI" },
  mezica: { lat: 46.521, lng: 14.854, cc: "SI" },
  dobrna: { lat: 46.337, lng: 15.226, cc: "SI" },
  ljubljana: { lat: 46.0569, lng: 14.5058, cc: "SI" },
  maribor: { lat: 46.5547, lng: 15.6467, cc: "SI" },
  groznjan: { lat: 45.359, lng: 13.724, cc: "HR" },
  megeve: { lat: 45.857, lng: 6.618, cc: "FR" },
  "saint-jean-de-maurienne": { lat: 45.273, lng: 6.348, cc: "FR" },
  "saint jean de maurienne": { lat: 45.273, lng: 6.348, cc: "FR" },
  frejus: { lat: 43.433, lng: 6.737, cc: "FR" },
  oslo: { lat: 59.9139, lng: 10.7522, cc: "NO" },
  budapest: { lat: 47.4979, lng: 19.0402, cc: "HU" },
  "ramsau am dachstein": { lat: 47.421, lng: 13.655, cc: "AT" },
  ramsau: { lat: 47.421, lng: 13.655, cc: "AT" },
  logrono: { lat: 42.4627, lng: -2.4447, cc: "ES" },
  kamnik: { lat: 46.2257, lng: 14.612, cc: "SI" },
  kocevje: { lat: 45.643, lng: 14.8633, cc: "SI" },
  samobor: { lat: 45.8031, lng: 15.7111, cc: "HR" },
  losinj: { lat: 44.531, lng: 14.468, cc: "HR" },
  "mali losinj": { lat: 44.531, lng: 14.468, cc: "HR" },
  premantura: { lat: 44.8, lng: 13.91, cc: "HR" },
  vodice: { lat: 43.761, lng: 15.775, cc: "HR" },
  posedarje: { lat: 44.213, lng: 15.476, cc: "HR" },
  vrana: { lat: 43.907, lng: 15.574, cc: "HR" },
  zminj: { lat: 45.143, lng: 13.908, cc: "HR" },
  "dugo selo": { lat: 45.806, lng: 16.244, cc: "HR" },
  metkovic: { lat: 43.054, lng: 17.683, cc: "HR" },
  predolac: { lat: 43.05, lng: 17.65, cc: "HR" },
  beretinec: { lat: 46.25, lng: 16.3, cc: "HR" },
  rocic: { lat: 45.35, lng: 14.05, cc: "HR" },
  "otok krk": { lat: 45.028, lng: 14.575, cc: "HR" },
  rajamaki: { lat: 60.528, lng: 24.75, cc: "FI" },
  valkeakoski: { lat: 61.267, lng: 24.031, cc: "FI" },
  kempele: { lat: 64.913, lng: 25.508, cc: "FI" },
  kokkola: { lat: 63.838, lng: 23.131, cc: "FI" },
  jyvaskyla: { lat: 62.2426, lng: 25.7473, cc: "FI" },
  seinajoki: { lat: 62.7903, lng: 22.8403, cc: "FI" },
  tuusula: { lat: 60.403, lng: 25.029, cc: "FI" },
  "selo pri vodicah": { lat: 46.166, lng: 14.5, cc: "SI" },
  rasica: { lat: 46.166, lng: 14.5, cc: "SI" },
  zavrsnica: { lat: 46.407, lng: 14.142, cc: "SI" },
  domzale: { lat: 46.139, lng: 14.595, cc: "SI" },
  "ravne na koroskem": { lat: 46.543, lng: 14.964, cc: "SI" },
  pohorje: { lat: 46.512, lng: 15.573, cc: "SI" },
  "soriska planina": { lat: 46.241, lng: 13.999, cc: "SI" },
  sorica: { lat: 46.241, lng: 13.999, cc: "SI" },
  "kranjska gora": { lat: 46.485, lng: 13.785, cc: "SI" },
  "dolenjske toplice": { lat: 45.757, lng: 15.059, cc: "SI" },
  middelkerke: { lat: 51.185, lng: 2.821, cc: "BE" },
  niel: { lat: 51.111, lng: 4.334, cc: "BE" },
  merksplas: { lat: 51.358, lng: 4.863, cc: "BE" },
  ruddervoorde: { lat: 51.098, lng: 3.207, cc: "BE" },
  diegem: { lat: 50.897, lng: 4.445, cc: "BE" },
  gullegem: { lat: 50.842, lng: 3.207, cc: "BE" },
  glasgow: { lat: 55.8642, lng: -4.2518, cc: "GB" },
  besancon: { lat: 47.2378, lng: 6.0241, cc: "FR" },
  hoogerheide: { lat: 51.424, lng: 4.325, cc: "NL" },
  houffalize: { lat: 50.132, lng: 5.789, cc: "BE" },
  varese: { lat: 45.8206, lng: 8.825, cc: "IT" },
  zeddam: { lat: 51.903, lng: 6.259, cc: "NL" },
  "vatra dornei": { lat: 47.35, lng: 25.367, cc: "RO" },
  monteceneri: { lat: 46.135, lng: 8.953, cc: "CH" },
  "cheile gradistei": { lat: 45.516, lng: 25.27, cc: "RO" },
  barcelona: { lat: 41.3874, lng: 2.1686, cc: "ES" },
  "benatky nad jizerou": { lat: 50.288, lng: 14.824, cc: "CZ" },
  benatky: { lat: 50.288, lng: 14.824, cc: "CZ" },
  compiegne: { lat: 49.4179, lng: 2.8261, cc: "FR" },
  graz: { lat: 47.0707, lng: 15.4395, cc: "AT" },
  sondrio: { lat: 46.171, lng: 9.871, cc: "IT" },
  allerod: { lat: 55.871, lng: 12.356, cc: "DK" },
  umag: { lat: 45.434, lng: 13.522, cc: "HR" },
  porec: { lat: 45.227, lng: 13.595, cc: "HR" },
  ljubac: { lat: 44.25, lng: 15.3, cc: "HR" },
  konavle: { lat: 42.45, lng: 18.38, cc: "HR" },
  rijeka: { lat: 45.3271, lng: 14.4422, cc: "HR" },
  zadar: { lat: 44.1194, lng: 15.2314, cc: "HR" },
  osijek: { lat: 45.555, lng: 18.6955, cc: "HR" },
  zagreb: { lat: 45.815, lng: 15.9819, cc: "HR" },
  varazdin: { lat: 46.3044, lng: 16.3378, cc: "HR" },
  sisak: { lat: 45.487, lng: 16.371, cc: "HR" },
  drnis: { lat: 43.863, lng: 16.156, cc: "HR" },
  karlovac: { lat: 45.493, lng: 15.555, cc: "HR" },
  punat: { lat: 45.014, lng: 14.629, cc: "HR" },
  vrbovec: { lat: 45.883, lng: 16.421, cc: "HR" },
  krizevci: { lat: 46.022, lng: 16.542, cc: "HR" },
  trakoscan: { lat: 46.259, lng: 15.95, cc: "HR" },
  nasice: { lat: 45.489, lng: 18.089, cc: "HR" },
  "gornji kneginec": { lat: 46.2, lng: 16.37, cc: "HR" },
  konya: { lat: 37.8746, lng: 32.4932, cc: "TR" },
  verona: { lat: 45.4384, lng: 10.9916, cc: "IT" },
  ramales: { lat: 43.256, lng: -3.464, cc: "ES" },
  "ramales de la victoria": { lat: 43.256, lng: -3.464, cc: "ES" },
  sofia: { lat: 42.6977, lng: 23.3219, cc: "BG" },
  vitosha: { lat: 42.57, lng: 23.28, cc: "BG" },
  sabinanigo: { lat: 42.519, lng: -0.366, cc: "ES" },
  "andorra la vella": { lat: 42.5063, lng: 1.5218, cc: "AD" },
  pertisau: { lat: 47.44, lng: 11.702, cc: "AT" },
  cuneo: { lat: 44.384, lng: 7.542, cc: "IT" },
  vejen: { lat: 55.482, lng: 9.138, cc: "DK" },
  nmnm: { lat: 49.5615, lng: 16.0742, cc: "CZ" },
  stupno: { lat: 49.817, lng: 13.598, cc: "CZ" },
  volyne: { lat: 49.1658, lng: 13.8863, cc: "CZ" },
  "volyně": { lat: 49.1658, lng: 13.8863, cc: "CZ" },
  kraliky: { lat: 50.0838, lng: 16.7603, cc: "CZ" },
  "králíky": { lat: 50.0838, lng: 16.7603, cc: "CZ" },
  holesov: { lat: 49.3333, lng: 17.5783, cc: "CZ" },
  "holešov": { lat: 49.3333, lng: 17.5783, cc: "CZ" },
  cercany: { lat: 49.8528, lng: 14.7061, cc: "CZ" },
  "čerčany": { lat: 49.8528, lng: 14.7061, cc: "CZ" },
  prysk: { lat: 50.7925, lng: 14.4711, cc: "CZ" },
  vedomice: { lat: 50.4919, lng: 14.2536, cc: "CZ" },
  "vědomice": { lat: 50.4919, lng: 14.2536, cc: "CZ" },
  spicak: { lat: 49.164, lng: 13.233, cc: "CZ" },
  "špičák": { lat: 49.164, lng: 13.233, cc: "CZ" },
  "bila beskydy": { lat: 49.442, lng: 18.453, cc: "CZ" },
  "zaluzi u tremosne": { lat: 49.82, lng: 13.4, cc: "CZ" },
  "záluží u třemošné": { lat: 49.82, lng: 13.4, cc: "CZ" },
  "bela pod pradedem": { lat: 50.15, lng: 17.196, cc: "CZ" },
  "bělá pod pradědem": { lat: 50.15, lng: 17.196, cc: "CZ" },
  "mesto touskov": { lat: 49.7758, lng: 13.251, cc: "CZ" },
  "město touškov": { lat: 49.7758, lng: 13.251, cc: "CZ" },
  touskov: { lat: 49.7758, lng: 13.251, cc: "CZ" },
  malec: { lat: 49.82, lng: 15.676, cc: "CZ" },
  "maleč": { lat: 49.82, lng: 15.676, cc: "CZ" },
  sec: { lat: 49.847, lng: 15.656, cc: "CZ" },
  "seč": { lat: 49.847, lng: 15.656, cc: "CZ" },
  bestvina: { lat: 49.837, lng: 15.596, cc: "CZ" },
  "běstvina": { lat: 49.837, lng: 15.596, cc: "CZ" },
  "svaty jur": { lat: 48.2522, lng: 17.2153, cc: "SK" },
  "svätý jur": { lat: 48.2522, lng: 17.2153, cc: "SK" },
  berlin: { lat: 52.52, lng: 13.405, cc: "DE" },
  munstertal: { lat: 47.855, lng: 7.784, cc: "DE" },
  "münstertal": { lat: 47.855, lng: 7.784, cc: "DE" },
  vogt: { lat: 47.777, lng: 9.767, cc: "DE" },
  baunach: { lat: 49.986, lng: 10.852, cc: "DE" },
  salzburg: { lat: 47.8095, lng: 13.055, cc: "AT" },
  nauders: { lat: 46.893, lng: 10.502, cc: "AT" },
  petzen: { lat: 46.523, lng: 14.763, cc: "AT" },
  bleiburg: { lat: 46.51, lng: 14.757, cc: "AT" },
  "st michael ob bleiburg": { lat: 46.51, lng: 14.757, cc: "AT" },
  claut: { lat: 46.268, lng: 12.514, cc: "IT" },
  allumiere: { lat: 42.157, lng: 11.904, cc: "IT" },
  scorze: { lat: 45.572, lng: 12.107, cc: "IT" },
  "scorzè": { lat: 45.572, lng: 12.107, cc: "IT" },
  vigonza: { lat: 45.447, lng: 11.984, cc: "IT" },
  capannori: { lat: 43.876, lng: 10.574, cc: "IT" },
  marlia: { lat: 43.898, lng: 10.556, cc: "IT" },
  "monteroni d arbia": { lat: 43.23, lng: 11.423, cc: "IT" },
  monteroni: { lat: 43.23, lng: 11.423, cc: "IT" },
  "pieve vergonte": { lat: 46.005, lng: 8.268, cc: "IT" },
  "terme vigliatore": { lat: 38.14, lng: 15.163, cc: "IT" },
  marconia: { lat: 40.43, lng: 16.71, cc: "IT" },
  "ospedaletto mantovano": { lat: 45.103, lng: 10.552, cc: "IT" },
  ospedaletto: { lat: 45.103, lng: 10.552, cc: "IT" },
  mocaiana: { lat: 43.417, lng: 12.233, cc: "IT" },
  wilchingen: { lat: 47.668, lng: 8.466, cc: "CH" },
  biskupija: { lat: 43.955, lng: 16.234, cc: "HR" },
  orino: { lat: 45.887, lng: 8.726, cc: "IT" },
  sarre: { lat: 45.718, lng: 7.258, cc: "IT" },
  "farra d alpago": { lat: 46.121, lng: 12.36, cc: "IT" },
  "cappella maggiore": { lat: 45.972, lng: 12.347, cc: "IT" },
  rovescala: { lat: 45.037, lng: 9.357, cc: "IT" },
  cheb: { lat: 50.0797, lng: 12.3739, cc: "CZ" },
  sobotka: { lat: 50.4674, lng: 15.1764, cc: "CZ" },
  hlucin: { lat: 49.897, lng: 18.192, cc: "CZ" },
  "hlučín": { lat: 49.897, lng: 18.192, cc: "CZ" },
  "ceska trebova": { lat: 49.901, lng: 16.444, cc: "CZ" },
  "česká třebová": { lat: 49.901, lng: 16.444, cc: "CZ" },
  bohumin: { lat: 49.904, lng: 18.357, cc: "CZ" },
  "bohumín": { lat: 49.904, lng: 18.357, cc: "CZ" },
  jistebnice: { lat: 49.486, lng: 14.527, cc: "CZ" },
  hulin: { lat: 49.317, lng: 17.464, cc: "CZ" },
  "hulín": { lat: 49.317, lng: 17.464, cc: "CZ" },
  cerchov: { lat: 49.383, lng: 12.783, cc: "CZ" },
  "čerchov": { lat: 49.383, lng: 12.783, cc: "CZ" },
  "cervena voda": { lat: 50.04, lng: 16.743, cc: "CZ" },
  "červená voda": { lat: 50.04, lng: 16.743, cc: "CZ" },
  "kouty nad desnou": { lat: 50.1, lng: 17.116, cc: "CZ" },
  koprivna: { lat: 50.046, lng: 16.947, cc: "CZ" },
  "kopřivná": { lat: 50.046, lng: 16.947, cc: "CZ" },
  "konstantinovy lazne": { lat: 49.879, lng: 12.78, cc: "CZ" },
  "konstantinovy lázně": { lat: 49.879, lng: 12.78, cc: "CZ" },
  boritov: { lat: 49.427, lng: 16.591, cc: "CZ" },
  "bořitov": { lat: 49.427, lng: 16.591, cc: "CZ" },
  "branka u opavy": { lat: 49.888, lng: 17.882, cc: "CZ" },
  choustnik: { lat: 49.333, lng: 14.838, cc: "CZ" },
  "choustník": { lat: 49.333, lng: 14.838, cc: "CZ" },
  zaben: { lat: 49.694, lng: 18.305, cc: "CZ" },
  "žabeň": { lat: 49.694, lng: 18.305, cc: "CZ" },
  bern: { lat: 46.948, lng: 7.4474, cc: "CH" },
  biasca: { lat: 46.36, lng: 8.972, cc: "CH" },
  airolo: { lat: 46.529, lng: 8.609, cc: "CH" },
  bulle: { lat: 46.618, lng: 7.057, cc: "CH" },
  delemont: { lat: 47.365, lng: 7.344, cc: "CH" },
  "delémont": { lat: 47.365, lng: 7.344, cc: "CH" },
  cottbus: { lat: 51.756, lng: 14.334, cc: "DE" },
  dusseldorf: { lat: 51.227, lng: 6.774, cc: "DE" },
  "düsseldorf": { lat: 51.227, lng: 6.774, cc: "DE" },
  flensburg: { lat: 54.782, lng: 9.437, cc: "DE" },
  "bad homburg": { lat: 50.227, lng: 8.618, cc: "DE" },
  "bad waldsee": { lat: 47.921, lng: 9.754, cc: "DE" },
  bergamo: { lat: 45.698, lng: 9.677, cc: "IT" },
  imola: { lat: 44.353, lng: 11.714, cc: "IT" },
  cesenatico: { lat: 44.2, lng: 12.399, cc: "IT" },
  bolzano: { lat: 46.498, lng: 11.354, cc: "IT" },
  bozen: { lat: 46.498, lng: 11.354, cc: "IT" },
  carpi: { lat: 44.783, lng: 10.885, cc: "IT" },
  szczyrk: { lat: 49.717, lng: 19.027, cc: "PL" },
  "czarna gora": { lat: 50.26, lng: 16.817, cc: "PL" },
  bystricany: { lat: 48.66, lng: 18.514, cc: "SK" },
  "bystričany": { lat: 48.66, lng: 18.514, cc: "SK" },
  koppl: { lat: 47.808, lng: 13.155, cc: "AT" },
  schladming: { lat: 47.393, lng: 13.687, cc: "AT" },
  bruck: { lat: 47.284, lng: 12.825, cc: "AT" },
  neckartenzlingen: { lat: 48.589, lng: 9.235, cc: "DE" },
  krnov: { lat: 50.09, lng: 17.704, cc: "CZ" },
  lidice: { lat: 50.143, lng: 14.2, cc: "CZ" },
  libeznice: { lat: 50.192, lng: 14.494, cc: "CZ" },
  "líbeznice": { lat: 50.192, lng: 14.494, cc: "CZ" },
  litvinovice: { lat: 48.962, lng: 14.451, cc: "CZ" },
  "litvínovice": { lat: 48.962, lng: 14.451, cc: "CZ" },
  "lomnice nad popelkou": { lat: 50.531, lng: 15.373, cc: "CZ" },
  "namest nad oslavou": { lat: 49.207, lng: 16.158, cc: "CZ" },
  "náměšť nad oslavou": { lat: 49.207, lng: 16.158, cc: "CZ" },
  opocno: { lat: 50.267, lng: 16.115, cc: "CZ" },
  "opočno": { lat: 50.267, lng: 16.115, cc: "CZ" },
  osecna: { lat: 50.695, lng: 14.921, cc: "CZ" },
  "osečná": { lat: 50.695, lng: 14.921, cc: "CZ" },
  kninice: { lat: 49.54, lng: 16.695, cc: "CZ" },
  "knínice": { lat: 49.54, lng: 16.695, cc: "CZ" },
  kobyli: { lat: 48.933, lng: 16.892, cc: "CZ" },
  "kobylí": { lat: 48.933, lng: 16.892, cc: "CZ" },
  bukovka: { lat: 50.123, lng: 15.624, cc: "CZ" },
  hrobcice: { lat: 50.517, lng: 13.733, cc: "CZ" },
  "hrobčice": { lat: 50.517, lng: 13.733, cc: "CZ" },
  "dolni lukavice": { lat: 49.595, lng: 13.344, cc: "CZ" },
  "dolní lukavice": { lat: 49.595, lng: 13.344, cc: "CZ" },
  "ceske petrovice": { lat: 50.062, lng: 16.606, cc: "CZ" },
  "české petrovice": { lat: 50.062, lng: 16.606, cc: "CZ" },
  talin: { lat: 49.249, lng: 14.226, cc: "CZ" },
  "tálín": { lat: 49.249, lng: 14.226, cc: "CZ" },
  kramolin: { lat: 49.134, lng: 16.132, cc: "CZ" },
  "kramolín": { lat: 49.134, lng: 16.132, cc: "CZ" },
  modrava: { lat: 49.024, lng: 13.499, cc: "CZ" },
  fusch: { lat: 47.212, lng: 12.838, cc: "AT" },
  "fusch an der grossglocknerstrasse": { lat: 47.212, lng: 12.838, cc: "AT" },
  schwaz: { lat: 47.351, lng: 11.707, cc: "AT" },
  kitzbuhel: { lat: 47.446, lng: 12.392, cc: "AT" },
  "kitzbühel": { lat: 47.446, lng: 12.392, cc: "AT" },
  kitzbuhler: { lat: 47.446, lng: 12.392, cc: "AT" },
  "kitzbühler": { lat: 47.446, lng: 12.392, cc: "AT" },
  prestic: { lat: 49.573, lng: 13.333, cc: "CZ" },
  "přeštic": { lat: 49.573, lng: 13.333, cc: "CZ" },
  "vysokeho myta": { lat: 49.953, lng: 16.162, cc: "CZ" },
  "vysokého mýta": { lat: 49.953, lng: 16.162, cc: "CZ" },
  gocarovy: { lat: 50.21, lng: 15.833, cc: "CZ" },
  "gočárovy": { lat: 50.21, lng: 15.833, cc: "CZ" },
  "gočárovy schody": { lat: 50.21, lng: 15.833, cc: "CZ" },
  morbisch: { lat: 47.755, lng: 16.666, cc: "AT" },
  "mörbisch": { lat: 47.755, lng: 16.666, cc: "AT" },
  eschenbach: { lat: 47.245, lng: 8.921, cc: "CH" },
  verbier: { lat: 46.096, lng: 7.229, cc: "CH" },
  charmey: { lat: 46.62, lng: 7.165, cc: "CH" },
  alterswil: { lat: 46.795, lng: 7.259, cc: "CH" },
  grandvillard: { lat: 46.538, lng: 7.075, cc: "CH" },
  // Remaining 2026 public pin gaps
  sobeslav: { lat: 49.26, lng: 14.719, cc: "CZ" },
  "soběslav": { lat: 49.26, lng: 14.719, cc: "CZ" },
  tanvald: { lat: 50.737, lng: 15.306, cc: "CZ" },
  unicov: { lat: 49.771, lng: 17.121, cc: "CZ" },
  "uničov": { lat: 49.771, lng: 17.121, cc: "CZ" },
  zamberk: { lat: 50.086, lng: 16.467, cc: "CZ" },
  "žamberk": { lat: 50.086, lng: 16.467, cc: "CZ" },
  "valasske klobouky": { lat: 49.141, lng: 18.008, cc: "CZ" },
  "valašské klobouky": { lat: 49.141, lng: 18.008, cc: "CZ" },
  "suchdol nad odrou": { lat: 49.79, lng: 17.928, cc: "CZ" },
  stod: { lat: 49.639, lng: 13.165, cc: "CZ" },
  "trhova kamenice": { lat: 49.789, lng: 15.818, cc: "CZ" },
  "trhová kamenice": { lat: 49.789, lng: 15.818, cc: "CZ" },
  troubelice: { lat: 49.818, lng: 17.081, cc: "CZ" },
  tuchorice: { lat: 50.284, lng: 13.662, cc: "CZ" },
  "tuchořice": { lat: 50.284, lng: 13.662, cc: "CZ" },
  tupadly: { lat: 49.346, lng: 13.385, cc: "CZ" },
  rackova: { lat: 49.27, lng: 17.55, cc: "CZ" },
  "racková": { lat: 49.27, lng: 17.55, cc: "CZ" },
  rusava: { lat: 49.405, lng: 17.706, cc: "CZ" },
  sedlejov: { lat: 49.228, lng: 15.496, cc: "CZ" },
  knezice: { lat: 49.271, lng: 15.681, cc: "CZ" },
  "kněžice": { lat: 49.271, lng: 15.681, cc: "CZ" },
  "hyncice pod susinou": { lat: 50.18, lng: 16.93, cc: "CZ" },
  "hynčice pod sušinou": { lat: 50.18, lng: 16.93, cc: "CZ" },
  cunkov: { lat: 49.455, lng: 14.545, cc: "CZ" },
  "dolni lhota": { lat: 49.842, lng: 18.092, cc: "CZ" },
  "dolní lhota": { lat: 49.842, lng: 18.092, cc: "CZ" },
  kukle: { lat: 49.249, lng: 14.226, cc: "CZ" },
  vratislavice: { lat: 50.74, lng: 15.09, cc: "CZ" },
  "zelechovice nad drevnici": { lat: 49.22, lng: 17.75, cc: "CZ" },
  "želechovice nad dřevnicí": { lat: 49.22, lng: 17.75, cc: "CZ" },
  zernov: { lat: 50.43, lng: 16.06, cc: "CZ" },
  "žernov": { lat: 50.43, lng: 16.06, cc: "CZ" },
  sudomer: { lat: 49.29, lng: 14.05, cc: "CZ" },
  "sudoměř": { lat: 49.29, lng: 14.05, cc: "CZ" },
  sudomerice: { lat: 48.866, lng: 17.257, cc: "CZ" },
  "sudoměřice": { lat: 48.866, lng: 17.257, cc: "CZ" },
  boletice: { lat: 48.825, lng: 14.217, cc: "CZ" },
  vlasenice: { lat: 49.35, lng: 15.05, cc: "CZ" },
  suhrovice: { lat: 50.52, lng: 15.05, cc: "CZ" },
  abensberg: { lat: 48.817, lng: 11.849, cc: "DE" },
  amtzell: { lat: 47.708, lng: 9.747, cc: "DE" },
  arnstadt: { lat: 50.834, lng: 10.946, cc: "DE" },
  "bad alexandersbad": { lat: 50.016, lng: 12.016, cc: "DE" },
  bobingen: { lat: 48.821, lng: 9.914, cc: "DE" },
  "böbingen": { lat: 48.821, lng: 9.914, cc: "DE" },
  boos: { lat: 49.796, lng: 7.717, cc: "DE" },
  burglengenfeld: { lat: 49.206, lng: 12.044, cc: "DE" },
  ehrenkirchen: { lat: 47.916, lng: 7.744, cc: "DE" },
  freisen: { lat: 49.55, lng: 7.25, cc: "DE" },
  friedewald: { lat: 50.883, lng: 9.867, cc: "DE" },
  gomaringen: { lat: 48.453, lng: 9.096, cc: "DE" },
  hof: { lat: 50.317, lng: 11.916, cc: "DE" },
  kirkel: { lat: 49.283, lng: 7.233, cc: "DE" },
  kottenheim: { lat: 50.35, lng: 7.25, cc: "DE" },
  munsingen: { lat: 48.411, lng: 9.497, cc: "DE" },
  "münsingen": { lat: 48.411, lng: 9.497, cc: "DE" },
  kelheim: { lat: 48.917, lng: 11.883, cc: "DE" },
  neunkirchen: { lat: 49.346, lng: 7.18, cc: "DE" },
  oberhof: { lat: 50.705, lng: 10.727, cc: "DE" },
  pegnitz: { lat: 49.757, lng: 11.545, cc: "DE" },
  reudern: { lat: 48.65, lng: 9.45, cc: "DE" },
  "sankt ingbert": { lat: 49.277, lng: 7.117, cc: "DE" },
  schesslitz: { lat: 49.977, lng: 11.033, cc: "DE" },
  schwarzenberg: { lat: 50.541, lng: 12.785, cc: "DE" },
  stammbach: { lat: 50.146, lng: 11.691, cc: "DE" },
  "steinbach am wald": { lat: 50.433, lng: 11.367, cc: "DE" },
  trieb: { lat: 50.15, lng: 11.85, cc: "DE" },
  parsberg: { lat: 49.16, lng: 11.72, cc: "DE" },
  urach: { lat: 48.493, lng: 9.399, cc: "DE" },
  waldmossingen: { lat: 48.283, lng: 8.55, cc: "DE" },
  "waldmössingen": { lat: 48.283, lng: 8.55, cc: "DE" },
  willingen: { lat: 51.294, lng: 8.609, cc: "DE" },
  warmensteinach: { lat: 50.0, lng: 11.783, cc: "DE" },
  "worth an der donau": { lat: 49.0, lng: 12.4, cc: "DE" },
  "wörth": { lat: 49.0, lng: 12.4, cc: "DE" },
  weissenburg: { lat: 49.03, lng: 10.97, cc: "DE" },
  "weißenburg": { lat: 49.03, lng: 10.97, cc: "DE" },
  schmelz: { lat: 49.433, lng: 6.85, cc: "DE" },
  oberthal: { lat: 49.516, lng: 7.1, cc: "DE" },
  painten: { lat: 48.997, lng: 11.81, cc: "DE" },
  "st georgen": { lat: 48.125, lng: 8.331, cc: "DE" },
  "st margen": { lat: 48.008, lng: 8.093, cc: "DE" },
  "st märgen": { lat: 48.008, lng: 8.093, cc: "DE" },
  "schweigen rechtenbach": { lat: 49.05, lng: 7.883, cc: "DE" },
  "wustenselbitz": { lat: 50.2, lng: 11.75, cc: "DE" },
  "wüstenselbitz": { lat: 50.2, lng: 11.75, cc: "DE" },
  "st luc": { lat: 46.15, lng: 7.61, cc: "CH" },
  "saint luc": { lat: 46.15, lng: 7.61, cc: "CH" },
  "villars sur ollon": { lat: 46.298, lng: 7.056, cc: "CH" },
  "les rasses": { lat: 46.85, lng: 6.55, cc: "CH" },
  "les rasse": { lat: 46.85, lng: 6.55, cc: "CH" },
  dohnany: { lat: 49.15, lng: 18.15, cc: "SK" },
  "dohňany": { lat: 49.15, lng: 18.15, cc: "SK" },
  "dolna marikova": { lat: 49.2, lng: 18.35, cc: "SK" },
  "dolná maríková": { lat: 49.2, lng: 18.35, cc: "SK" },
  gajary: { lat: 48.466, lng: 16.916, cc: "SK" },
  kosutka: { lat: 49.084, lng: 18.628, cc: "SK" },
  "košútka": { lat: 49.084, lng: 18.628, cc: "SK" },
  "malino brdo": { lat: 49.083, lng: 19.273, cc: "SK" },
  "malinô brdo": { lat: 49.083, lng: 19.273, cc: "SK" },
  "velka raca": { lat: 49.423, lng: 18.876, cc: "SK" },
  "veľká rača": { lat: 49.423, lng: 18.876, cc: "SK" },
  oschadnica: { lat: 49.437, lng: 18.876, cc: "SK" },
  "oščadnica": { lat: 49.437, lng: 18.876, cc: "SK" },
  "myto pod dumbierom": { lat: 48.856, lng: 19.592, cc: "SK" },
  "mýto pod ďumbierom": { lat: 48.856, lng: 19.592, cc: "SK" },
  "mokra luka": { lat: 48.734, lng: 20.143, cc: "SK" },
  "mokrá lúka": { lat: 48.734, lng: 20.143, cc: "SK" },
  partizanske: { lat: 48.628, lng: 18.377, cc: "SK" },
  "partizánske": { lat: 48.628, lng: 18.377, cc: "SK" },
  komarno: { lat: 47.763, lng: 18.121, cc: "SK" },
  "komárno": { lat: 47.763, lng: 18.121, cc: "SK" },
  "rajecke teplice": { lat: 49.128, lng: 18.682, cc: "SK" },
  "rajecké teplice": { lat: 49.128, lng: 18.682, cc: "SK" },
  topolniky: { lat: 47.96, lng: 17.78, cc: "SK" },
  "topoľníky": { lat: 47.96, lng: 17.78, cc: "SK" },
  sigord: { lat: 48.95, lng: 21.35, cc: "SK" },
  hubkova: { lat: 48.93, lng: 21.9, cc: "SK" },
  "hubková": { lat: 48.93, lng: 21.9, cc: "SK" },
  raslavice: { lat: 49.15, lng: 21.32, cc: "SK" },
  brezovica: { lat: 49.148, lng: 20.85, cc: "SK" },
  podhorany: { lat: 49.135, lng: 21.348, cc: "SK" },
  mlynceky: { lat: 49.167, lng: 20.367, cc: "SK" },
  "mlynčeky": { lat: 49.167, lng: 20.367, cc: "SK" },
  bardejov: { lat: 49.294, lng: 21.276, cc: "SK" },
  sabinov: { lat: 49.103, lng: 21.099, cc: "SK" },
  ruskov: { lat: 48.7, lng: 21.45, cc: "SK" },
  semmering: { lat: 47.631, lng: 15.83, cc: "AT" },
  schockl: { lat: 47.191, lng: 15.466, cc: "AT" },
  "schöckl": { lat: 47.191, lng: 15.466, cc: "AT" },
  "st radegund": { lat: 47.181, lng: 15.487, cc: "AT" },
  "st radegund bei graz": { lat: 47.181, lng: 15.487, cc: "AT" },
  weissensee: { lat: 46.718, lng: 13.292, cc: "AT" },
  lienz: { lat: 46.837, lng: 12.769, cc: "AT" },
  lermoos: { lat: 47.401, lng: 10.881, cc: "AT" },
  ottenschlag: { lat: 48.47, lng: 14.05, cc: "AT" },
  "ottenschlag im muhlkreis": { lat: 48.47, lng: 14.05, cc: "AT" },
  veitsch: { lat: 47.578, lng: 15.494, cc: "AT" },
  haiming: { lat: 47.248, lng: 10.885, cc: "AT" },
  langenlois: { lat: 48.472, lng: 15.685, cc: "AT" },
  zobing: { lat: 48.495, lng: 15.7, cc: "AT" },
  "zöbing": { lat: 48.495, lng: 15.7, cc: "AT" },
  mollbrucke: { lat: 46.838, lng: 13.375, cc: "AT" },
  moellbrucke: { lat: 46.838, lng: 13.375, cc: "AT" },
  moellbruecke: { lat: 46.838, lng: 13.375, cc: "AT" },
  "möllbrücke": { lat: 46.838, lng: 13.375, cc: "AT" },
  konigswiesen: { lat: 48.405, lng: 14.838, cc: "AT" },
  "königswiesen": { lat: 48.405, lng: 14.838, cc: "AT" },
  loosdorf: { lat: 48.2, lng: 15.4, cc: "AT" },
  windhaag: { lat: 48.467, lng: 14.683, cc: "AT" },
  "windhaag bei perg": { lat: 48.284, lng: 14.682, cc: "AT" },
  kirchschlag: { lat: 47.517, lng: 16.3, cc: "AT" },
  "kirchschlag in der buckligen welt": { lat: 47.517, lng: 16.3, cc: "AT" },
  "bad salzdetfurth": { lat: 52.058, lng: 10.006, cc: "DE" },
  perl: { lat: 49.473, lng: 6.374, cc: "DE" },
  bremen: { lat: 53.079, lng: 8.802, cc: "DE" },
  lohne: { lat: 52.666, lng: 8.238, cc: "DE" },
  chemnitz: { lat: 50.833, lng: 12.917, cc: "DE" },
  vaihingen: { lat: 48.933, lng: 8.961, cc: "DE" },
  magstadt: { lat: 48.742, lng: 8.965, cc: "DE" },
  stahnsdorf: { lat: 52.392, lng: 13.217, cc: "DE" },
  vechta: { lat: 52.726, lng: 8.286, cc: "DE" },
  porac: { lat: 48.883, lng: 20.533, cc: "SK" },
  "poráč": { lat: 48.883, lng: 20.533, cc: "SK" },
  ratkovce: { lat: 48.45, lng: 17.8, cc: "SK" },
  sulov: { lat: 49.168, lng: 18.59, cc: "SK" },
  "súľov": { lat: 49.168, lng: 18.59, cc: "SK" },
  topolcianky: { lat: 48.42, lng: 18.41, cc: "SK" },
  "topoľčianky": { lat: 48.42, lng: 18.41, cc: "SK" },
  "zlatnicka dolina": { lat: 48.9, lng: 18.1, cc: "SK" },
  "zlatnícka dolina": { lat: 48.9, lng: 18.1, cc: "SK" },
  "slovensky raj": { lat: 48.85, lng: 20.35, cc: "SK" },
  "slovenský raj": { lat: 48.85, lng: 20.35, cc: "SK" },
  drozdovo: { lat: 49.05, lng: 19.5, cc: "SK" },
  halinow: { lat: 52.225, lng: 21.355, cc: "PL" },
  "halinów": { lat: 52.225, lng: 21.355, cc: "PL" },
  wawer: { lat: 52.22, lng: 21.15, cc: "PL" },
  warszawa: { lat: 52.23, lng: 21.01, cc: "PL" },
  laskarzew: { lat: 51.79, lng: 21.59, cc: "PL" },
  "łaskarzew": { lat: 51.79, lng: 21.59, cc: "PL" },
  serock: { lat: 52.508, lng: 21.07, cc: "PL" },
  nadarzyn: { lat: 52.124, lng: 20.804, cc: "PL" },
  legionowo: { lat: 52.401, lng: 20.927, cc: "PL" },
  radzymin: { lat: 52.416, lng: 21.184, cc: "PL" },
  marki: { lat: 52.321, lng: 21.104, cc: "PL" },
  ossow: { lat: 52.31, lng: 21.16, cc: "PL" },
  "ossów": { lat: 52.31, lng: 21.16, cc: "PL" },
  pionki: { lat: 51.476, lng: 21.45, cc: "PL" },
  otwock: { lat: 52.106, lng: 21.261, cc: "PL" },
  ciechanowiec: { lat: 52.678, lng: 22.498, cc: "PL" },
  perlejewo: { lat: 52.566, lng: 22.566, cc: "PL" },
  stoczek: { lat: 51.961, lng: 21.971, cc: "PL" },
  "zabia wola": { lat: 52.033, lng: 20.692, cc: "PL" },
  "żabia wola": { lat: 52.033, lng: 20.692, cc: "PL" },
  starachowice: { lat: 51.038, lng: 21.072, cc: "PL" },
  hausach: { lat: 48.285, lng: 8.18, cc: "DE" },
  wombach: { lat: 50.011, lng: 9.589, cc: "DE" },
  asch: { lat: 50.224, lng: 12.195, cc: "CZ" },
  gyongyos: { lat: 47.785, lng: 19.928, cc: "HU" },
  "gyöngyös": { lat: 47.785, lng: 19.928, cc: "HU" },
  mondorf: { lat: 49.507, lng: 6.281, cc: "LU" },
  "novi sad": { lat: 45.267, lng: 19.834, cc: "RS" },
  paphos: { lat: 34.772, lng: 32.424, cc: "CY" },
  tartu: { lat: 58.378, lng: 26.729, cc: "EE" },
  "eau d heure": { lat: 50.183, lng: 4.367, cc: "BE" },
  fidenza: { lat: 44.866, lng: 10.061, cc: "IT" },
  siena: { lat: 43.319, lng: 11.331, cc: "IT" },
  serravalle: { lat: 43.906, lng: 10.833, cc: "IT" },
  casalguidi: { lat: 43.906, lng: 10.833, cc: "IT" },
  sachsenring: { lat: 50.7917, lng: 12.6889, cc: "DE" },
  schweigen: { lat: 49.05, lng: 7.883, cc: "DE" },
  trier: { lat: 49.7499, lng: 6.6371, cc: "DE" },
  einsiedel: { lat: 50.775, lng: 12.97, cc: "DE" },
  "chemnitz einsiedel": { lat: 50.775, lng: 12.97, cc: "DE" },
  gippingen: { lat: 47.55, lng: 8.22, cc: "CH" },
  streufdorf: { lat: 50.4, lng: 10.65, cc: "DE" },
  nurburgring: { lat: 50.3356, lng: 6.9475, cc: "DE" },
  "nürburgring": { lat: 50.3356, lng: 6.9475, cc: "DE" },
  schonaich: { lat: 48.658, lng: 8.996, cc: "DE" },
  "schönaich": { lat: 48.658, lng: 8.996, cc: "DE" },
  waldburg: { lat: 47.757, lng: 9.713, cc: "DE" },
  "bad schussenried": { lat: 48.006, lng: 9.659, cc: "DE" },
  berghulen: { lat: 48.464, lng: 9.761, cc: "DE" },
  "berghülen": { lat: 48.464, lng: 9.761, cc: "DE" },
  mittelbuch: { lat: 48.07, lng: 9.75, cc: "DE" },
  karbach: { lat: 50.05, lng: 9.65, cc: "DE" },
  uberherrn: { lat: 49.241, lng: 6.698, cc: "DE" },
  "überherrn": { lat: 49.241, lng: 6.698, cc: "DE" },
  offenbach: { lat: 50.1, lng: 8.766, cc: "DE" },
  ogrodniczki: { lat: 53.18, lng: 23.25, cc: "PL" },
  rzasnik: { lat: 52.7, lng: 21.37, cc: "PL" },
  "rząśnik": { lat: 52.7, lng: 21.37, cc: "PL" },
  nedzerzew: { lat: 51.97, lng: 18.5, cc: "PL" },
  "nędzerzew": { lat: 51.97, lng: 18.5, cc: "PL" },
  "krynica zdroj": { lat: 49.421, lng: 20.959, cc: "PL" },
  "krynica-zdrój": { lat: 49.421, lng: 20.959, cc: "PL" },
  "rabka zdroj": { lat: 49.609, lng: 19.966, cc: "PL" },
  "rabka-zdrój": { lat: 49.609, lng: 19.966, cc: "PL" },
  "sobótka": { lat: 50.899, lng: 16.744, cc: "PL" },
  "boguszow gorce": { lat: 50.755, lng: 16.205, cc: "PL" },
  "boguszów-gorce": { lat: 50.755, lng: 16.205, cc: "PL" },
  boguszow: { lat: 50.755, lng: 16.205, cc: "PL" },
  trnava: { lat: 48.3774, lng: 17.5883, cc: "SK" },
  "jaslovske bohunice": { lat: 48.48, lng: 17.67, cc: "SK" },
  "jaslovské bohunice": { lat: 48.48, lng: 17.67, cc: "SK" },
  dubodiel: { lat: 48.81, lng: 18.12, cc: "SK" },
  "dubnica nad vahom": { lat: 48.96, lng: 18.166, cc: "SK" },
  "dubnica nad váhom": { lat: 48.96, lng: 18.166, cc: "SK" },
  tajna: { lat: 48.29, lng: 18.38, cc: "SK" },
  "tajná": { lat: 48.29, lng: 18.38, cc: "SK" },
  vrable: { lat: 48.24, lng: 18.31, cc: "SK" },
  "vráble": { lat: 48.24, lng: 18.31, cc: "SK" },
  podhajska: { lat: 48.17, lng: 18.34, cc: "SK" },
  "podhájska": { lat: 48.17, lng: 18.34, cc: "SK" },
  "banovce nad bebravou": { lat: 48.72, lng: 18.26, cc: "SK" },
  "bánovce nad bebravou": { lat: 48.72, lng: 18.26, cc: "SK" },
  "ziar nad hronom": { lat: 48.59, lng: 18.85, cc: "SK" },
  "žiar nad hronom": { lat: 48.59, lng: 18.85, cc: "SK" },
  "nova bana": { lat: 48.42, lng: 18.64, cc: "SK" },
  "nová baňa": { lat: 48.42, lng: 18.64, cc: "SK" },
  tuhar: { lat: 48.42, lng: 19.77, cc: "SK" },
  "tuhár": { lat: 48.42, lng: 19.77, cc: "SK" },
  smolenice: { lat: 48.51, lng: 17.43, cc: "SK" },
  "klastor pod znievom": { lat: 48.97, lng: 18.77, cc: "SK" },
  "kláštor pod znievom": { lat: 48.97, lng: 18.77, cc: "SK" },
  leonding: { lat: 48.28, lng: 14.25, cc: "AT" },
  wels: { lat: 48.1565, lng: 14.0246, cc: "AT" },
  rankweil: { lat: 47.27, lng: 9.64, cc: "AT" },
  wieselburg: { lat: 48.13, lng: 15.14, cc: "AT" },
  kindberg: { lat: 47.5, lng: 15.45, cc: "AT" },
  neckenmarkt: { lat: 47.6, lng: 16.55, cc: "AT" },
  pernitz: { lat: 47.9, lng: 15.96, cc: "AT" },
  eberstalzell: { lat: 48.08, lng: 13.98, cc: "AT" },
  walding: { lat: 48.35, lng: 14.21, cc: "AT" },
  soll: { lat: 47.5, lng: 12.19, cc: "AT" },
  "söll": { lat: 47.5, lng: 12.19, cc: "AT" },
  grossenzersdorf: { lat: 48.2, lng: 16.55, cc: "AT" },
  "großenzerdorf": { lat: 48.2, lng: 16.55, cc: "AT" },
  "großenzenersdorf": { lat: 48.2, lng: 16.55, cc: "AT" },
  "weißenbach am attersee": { lat: 47.82, lng: 13.56, cc: "AT" },
  weissenbach: { lat: 47.82, lng: 13.56, cc: "AT" },
  "novy malin": { lat: 49.99, lng: 17.03, cc: "CZ" },
  "nový malín": { lat: 49.99, lng: 17.03, cc: "CZ" },
  "velka bites": { lat: 49.29, lng: 16.23, cc: "CZ" },
  "velká bíteš": { lat: 49.29, lng: 16.23, cc: "CZ" },
  "vlci hora": { lat: 50.93, lng: 14.47, cc: "CZ" },
  "vlčí hora": { lat: 50.93, lng: 14.47, cc: "CZ" },
  "bad orb": { lat: 50.227, lng: 9.347, cc: "DE" },
  podbrezova: { lat: 48.811, lng: 19.532, cc: "SK" },
  "podbrezová": { lat: 48.811, lng: 19.532, cc: "SK" },
  sered: { lat: 48.289, lng: 17.727, cc: "SK" },
  "sereď": { lat: 48.289, lng: 17.727, cc: "SK" },
  selce: { lat: 48.766, lng: 19.216, cc: "SK" },
  kalnica: { lat: 48.76, lng: 17.97, cc: "SK" },
  "kálnica": { lat: 48.76, lng: 17.97, cc: "SK" },
  "liptovsky mikulas": { lat: 49.081, lng: 19.612, cc: "SK" },
  "liptovský mikuláš": { lat: 49.081, lng: 19.612, cc: "SK" },
  "bratislava raca": { lat: 48.2205, lng: 17.1558, cc: "SK" },
  raca: { lat: 48.2205, lng: 17.1558, cc: "SK" },
  "rača": { lat: 48.2205, lng: 17.1558, cc: "SK" },
  "knizkova dolina": { lat: 48.2205, lng: 17.1558, cc: "SK" },
  "knižková dolina": { lat: 48.2205, lng: 17.1558, cc: "SK" },
  "amfiteater raca": { lat: 48.2205, lng: 17.1558, cc: "SK" },
  "dunajska luzna": { lat: 48.086, lng: 17.261, cc: "SK" },
  "dunajská lužná": { lat: 48.086, lng: 17.261, cc: "SK" },
  namestovo: { lat: 49.407, lng: 19.48, cc: "SK" },
  "námestovo": { lat: 49.407, lng: 19.48, cc: "SK" },
  zehra: { lat: 48.98, lng: 20.79, cc: "SK" },
  "žehra": { lat: 48.98, lng: 20.79, cc: "SK" },
  surany: { lat: 48.087, lng: 18.186, cc: "SK" },
  "šurany": { lat: 48.087, lng: 18.186, cc: "SK" },
  zariecie: { lat: 49.18, lng: 18.27, cc: "SK" },
  "záriečie": { lat: 49.18, lng: 18.27, cc: "SK" },
  rudina: { lat: 49.3, lng: 18.74, cc: "SK" },
  "velke zaluzie": { lat: 48.31, lng: 17.95, cc: "SK" },
  "veľké zálužie": { lat: 48.31, lng: 17.95, cc: "SK" },
  poprad: { lat: 49.061, lng: 20.298, cc: "SK" },
  ruzomberok: { lat: 49.075, lng: 19.307, cc: "SK" },
  "ružomberok": { lat: 49.075, lng: 19.307, cc: "SK" },
  "budapešť": { lat: 47.498, lng: 19.04, cc: "HU" },
  vosendorf: { lat: 48.121, lng: 16.34, cc: "AT" },
  "vösendorf": { lat: 48.121, lng: 16.34, cc: "AT" },
  baierdorf: { lat: 46.83, lng: 15.73, cc: "AT" },
  muhlen: { lat: 47.03, lng: 14.51, cc: "AT" },
  "mühlen": { lat: 47.03, lng: 14.51, cc: "AT" },
  bohnice: { lat: 50.134, lng: 14.428, cc: "CZ" },
  "praha bohnice": { lat: 50.134, lng: 14.428, cc: "CZ" },
  liskovec: { lat: 49.168, lng: 16.563, cc: "CZ" },
  "brno liskovec": { lat: 49.168, lng: 16.563, cc: "CZ" },
  "praha repy": { lat: 50.067, lng: 14.311, cc: "CZ" },
  "brno favorit": { lat: 49.178, lng: 16.57, cc: "CZ" },
  innsbruck: { lat: 47.2692, lng: 11.4041, cc: "AT" },
  innsbrucker: { lat: 47.2692, lng: 11.4041, cc: "AT" },
  linz: { lat: 48.3069, lng: 14.2858, cc: "AT" },
  klagenfurt: { lat: 46.6247, lng: 14.3053, cc: "AT" },
  "st polten": { lat: 48.2058, lng: 15.6232, cc: "AT" },
  "st. polten": { lat: 48.2058, lng: 15.6232, cc: "AT" },
  "sankt polten": { lat: 48.2058, lng: 15.6232, cc: "AT" },
  "st pölten": { lat: 48.2058, lng: 15.6232, cc: "AT" },
  wolfsberg: { lat: 46.839, lng: 14.845, cc: "AT" },
  lambach: { lat: 48.094, lng: 13.875, cc: "AT" },
  purgstall: { lat: 48.056, lng: 15.135, cc: "AT" },
  boheimkirchen: { lat: 48.197, lng: 15.762, cc: "AT" },
  "böheimkirchen": { lat: 48.197, lng: 15.762, cc: "AT" },
  "bad ischl": { lat: 47.711, lng: 13.625, cc: "AT" },
  hinterbruhl: { lat: 48.086, lng: 16.248, cc: "AT" },
  "hinterbrühl": { lat: 48.086, lng: 16.248, cc: "AT" },
  zauberberg: { lat: 47.641, lng: 15.831, cc: "AT" },
  arlberg: { lat: 47.132, lng: 10.269, cc: "AT" },
  attersee: { lat: 47.916, lng: 13.55, cc: "AT" },
  atterbiker: { lat: 47.916, lng: 13.55, cc: "AT" },
  kurnberg: { lat: 48.321, lng: 14.166, cc: "AT" },
  "kürnberg": { lat: 48.321, lng: 14.166, cc: "AT" },
  wolomin: { lat: 52.351, lng: 21.237, cc: "PL" },
  "wołomin": { lat: 52.351, lng: 21.237, cc: "PL" },
  "powiat wolominski": { lat: 52.351, lng: 21.237, cc: "PL" },
  langenweisbach: { lat: 50.599, lng: 12.582, cc: "DE" },
  "langenweißbach": { lat: 50.599, lng: 12.582, cc: "DE" },
};

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bn\//g, "nad ")
    .replace(/\b([ld])['’]/gi, "$1 ")
    .replace(/['’`]/g, "")
    .replace(/[-–—_/,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COUNTRY_WORDS: { re: RegExp; cc: string }[] = [
  { re: /\b(united states|usa|u\.s\.a\.|amerika)\b/i, cc: "US" },
  { re: /\b(canada|kanada)\b/i, cc: "CA" },
  { re: /\b(china|čína|cina)\b/i, cc: "CN" },
  { re: /\b(chile)\b/i, cc: "CL" },
  { re: /\b(andorra)\b/i, cc: "AD" },
  { re: /\b(korea|south korea|jižní korea)\b/i, cc: "KR" },
  { re: /\b(netherlands|nizozemsko|holland|nederland|niederlande)\b/i, cc: "NL" },
  { re: /\b(germany|deutschland|německo|nemecko)\b/i, cc: "DE" },
  { re: /\b(austria|österreich|rakousko)\b/i, cc: "AT" },
  { re: /\b(switzerland|schweiz|švýcarsko|svycarsko)\b/i, cc: "CH" },
  { re: /\b(slovenia|slovenija|slovinsko|slowenien)\b/i, cc: "SI" },
  { re: /\b(slovakia|slovensko)\b/i, cc: "SK" },
  { re: /\b(denmark|dánsko|dansko|dänemark|danemark)\b/i, cc: "DK" },
  { re: /\b(poland|polsko)\b/i, cc: "PL" },
  { re: /\b(italy|italien|italia|italsko|itálie)\b/i, cc: "IT" },
  { re: /\b(france|frankreich|francie)\b/i, cc: "FR" },
  { re: /\b(belgium|belgie|belgicko|belgien|belgique)\b/i, cc: "BE" },
  { re: /\b(spain|spanien|španělsko)\b/i, cc: "ES" },
  { re: /\b(portugal)\b/i, cc: "PT" },
  { re: /\b(japan|japonsko)\b/i, cc: "JP" },
  { re: /\b(south africa)\b/i, cc: "ZA" },
  { re: /\b(hungary|ungarn|maďarsko|madarsko)\b/i, cc: "HU" },
  { re: /\b(serbia|srbsko)\b/i, cc: "RS" },
  { re: /\b(luxembourg|luxemburg|lucembursko)\b/i, cc: "LU" },
  { re: /\b(cyprus|kypr)\b/i, cc: "CY" },
  { re: /\b(estonia|estonsko)\b/i, cc: "EE" },
];

/** Longest gazetteer keys first — used to pull a town out of an event title. */
let gazetteerKeysByLength: string[] | null = null;
function getGazetteerKeys(): string[] {
  if (!gazetteerKeysByLength) {
    gazetteerKeysByLength = Object.keys(GAZETTEER).sort((a, b) => b.length - a.length);
  }
  return gazetteerKeysByLength;
}

/** Strip junk prefixes like "XCE Skočice" / "UCI CN" and detect country. */
export function cleanGeocodeQuery(
  raw: string,
  countryHint?: string | null,
): { query: string; countryCode: string } {
  let text = raw.replace(/\s+/g, " ").trim();
  let cc = (countryHint || "CZ").toUpperCase();

  for (const { re, cc: c } of COUNTRY_WORDS) {
    if (re.test(text)) {
      cc = c;
      text = text.replace(re, " ").replace(/,+/g, ",").trim();
    }
  }

  // Strip ISO / country suffixes anywhere near the end: "Blovice, CZ" / "Montreal, Canada, CZ"
  text = text
    .replace(
      new RegExp(
        `,\\s*(${[...EUROPE_COUNTRY_CODES, "UK", "US", "CA", "CN", "CL", "JP", "ZA", "KR"].join("|")})\\s*$`,
        "gi",
      ),
      "",
    )
    .replace(/,\s*(new york|ny|utah|sardinia|valais|british columbia)\s*$/i, "")
    .trim();

  // Drop date fragments: "5-6/9", "27/6", "15/8", "16/5"
  text = text.replace(/\b\d{1,2}([-–/]\d{1,2}){1,2}(\/\d{2,4})?\b/g, " ");

  // Italian comune + province: "CAPANNORI (LU)", "PIEVE VERGONTE VB"
  text = text.replace(/\s*\([a-z]{2}\)\s*/gi, " ");
  text = text.replace(/\bfraz\.?\s+/gi, " ");
  text = text.replace(
    /\s+[–-]\s+(tirol|tyrol|tyrolsko|k[aä]rnten|carinthia|salzburg|steiermark|styria|vorarlberg|wien|vienna|burgenland|ober((o|ö)sterreich)?|nieder((o|ö)sterreich)?|valais|wallis|sardinia)\s*$/i,
    "",
  );
  if (cc === "CH") {
    text = text.replace(
      /\s+\b(ag|ai|ar|be|bl|bs|fr|ge|gl|gr|ju|lu|ne|nw|ow|sg|sh|so|sz|tg|ti|ur|vd|vs|zg|zh)\s*$/i,
      "",
    );
  }

  // Drop event-title noise
  text = text
    .replace(/^(partnersk[aá]\s+akce\s*[-–:]?\s*)/i, "")
    .replace(/\b(bikemaraton|bike\s*maraton|maraton|trophy|classic|cup|tour|race of|nova sport junior)\b/gi, " ")
    .replace(/^(xce|xco|xcc|xcm|xc|dh|edr|mtb|uci|cn|c1|c2|c3)\s+/i, "")
    .replace(/\b(areal|areál|ski|letiště|letiste|kláštera|klasatera|traily|lesopark|kategorie|prestige)\b/gi, " ")
    .replace(/\b(casovka|časovka|mzal|z[aá]l\+jal)\b/gi, " ")
    .replace(/\b(sportanlagen|vereinsheim|naturfreunde\s+haus|flugplatz|festplatz)\b/gi, " ")
    .replace(/\b\d{4,5}\b/g, " ") // German PLZ
    .replace(/\bn\s*\/\s*n\b/gi, "nad nisou")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
    .trim();

  // Prefer last segment after " - " when it looks like a city (… - Ústí nad Labem)
  let primary = text;
  // Normalize Czech "n/Lužnicí" / "p/Čerch" before any `/` split
  primary = primary.replace(/\b([np])\s*[./]\s*/gi, (_, p) =>
    p.toLowerCase() === "n" ? "nad " : "pod ",
  );
  const dashParts = primary.split(/\s+[–-]\s+/);
  if (dashParts.length > 1) {
    const cleanedParts = dashParts.map((p) => p.replace(/\bfraz\.?\s+/gi, "").trim()).filter(Boolean);
    const gazHit = cleanedParts.find((p) => GAZETTEER[fold(p)]);
    const last = cleanedParts[cleanedParts.length - 1]!;
    const first = cleanedParts[0]!;
    primary = gazHit || (last.length >= 3 ? last : first);
  } else {
    primary = primary.split(/\(/)[0]?.trim() || primary;
  }
  // If still "City, Something", keep first comma segment (often the place)
  if (primary.includes(",")) {
    primary = primary.split(",")[0]!.trim();
  }
  primary = primary.replace(/\s+/g, " ").replace(/^[\s,.-]+|[\s,.-]+$/g, "").trim();

  const trailingProv = primary.match(/^(.*\S)\s+([A-Z]{2})$/);
  if (trailingProv && GAZETTEER[fold(trailingProv[1]!)]) {
    primary = trailingProv[1]!.trim();
  }

  // Reject garbage / category-only labels
  if (
    !primary ||
    primary.length < 2 ||
    /^(uci(\s+(c1|c2|c3|cn))?|cn|c1|c2|c3|czech|czechia|unknown|silnice|—|-|\?+)$/i.test(
      primary,
    ) ||
    /^[a-z]$/i.test(primary) ||
    /^https?:/i.test(primary)
  ) {
    return { query: "", countryCode: cc };
  }

  return { query: primary, countryCode: cc };
}

/** Pull "GPS: 49.66N, 14.39E" style coords from place text. */
export function extractEmbeddedGps(raw: string): GeocodeResult | null {
  const m = raw.match(
    /(\d{1,2}(?:\.\d+)?)\s*([NS])\s*[,;\s]+\s*(\d{1,3}(?:\.\d+)?)\s*([EW])/i,
  );
  if (!m) return null;
  let lat = Number(m[1]);
  let lng = Number(m[3]);
  if (m[2]!.toUpperCase() === "S") lat = -lat;
  if (m[4]!.toUpperCase() === "W") lng = -lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function gazetteerLookup(query: string): GeocodeResult | null {
  const key = fold(query);
  if (GAZETTEER[key]) {
    const g = GAZETTEER[key];
    return { lat: g.lat, lng: g.lng, countryCode: g.cc, displayName: query };
  }
  // Try last/first token slices — "Areál SKI Malenovice" → malenovice
  const parts = key.split(" ").filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const slice = parts.slice(i).join(" ");
    if (GAZETTEER[slice]) {
      const g = GAZETTEER[slice];
      return { lat: g.lat, lng: g.lng, countryCode: g.cc, displayName: query };
    }
  }
  for (let n = Math.min(4, parts.length); n >= 1; n--) {
    const slice = parts.slice(-n).join(" ");
    if (GAZETTEER[slice]) {
      const g = GAZETTEER[slice];
      return { lat: g.lat, lng: g.lng, countryCode: g.cc, displayName: query };
    }
  }
  // Scan full title for a known town ("Znojmo Burčák Tour" → znojmo)
  for (const town of getGazetteerKeys()) {
    if (town.length < 3) continue;
    const re = new RegExp(`(?:^|\\s)${town.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`);
    if (re.test(key)) {
      const g = GAZETTEER[town]!;
      return { lat: g.lat, lng: g.lng, countryCode: g.cc, displayName: town };
    }
  }
  return null;
}

async function nominatimSearch(query: string, countryCode: string): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
    addressdetails: "0",
  });
  if (countryCode && countryCode.length === 2) {
    params.set("countrycodes", countryCode.toLowerCase());
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      "User-Agent": "StartlineBot/0.1 (race calendar; contact@startline.app)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { lat: string; lon: string; display_name?: string }[];
  if (!data?.[0]) {
    // retry without country restriction (once)
    if (countryCode) {
      const p2 = new URLSearchParams({ q: query, format: "json", limit: "1" });
      const res2 = await fetch(`https://nominatim.openstreetmap.org/search?${p2}`, {
        headers: {
          "User-Agent": "StartlineBot/0.1 (race calendar; contact@startline.app)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res2.ok) return null;
      const data2 = (await res2.json()) as { lat: string; lon: string; display_name?: string }[];
      if (!data2?.[0]) return null;
      return {
        lat: Number(data2[0].lat),
        lng: Number(data2[0].lon),
        displayName: data2[0].display_name,
      };
    }
    return null;
  }
  return {
    lat: Number(data[0].lat),
    lng: Number(data[0].lon),
    displayName: data[0].display_name,
    countryCode,
  };
}

export function geocodeFromGazetteer(
  raw: string,
  countryHint?: string | null,
): GeocodeResult | null {
  const gps = extractEmbeddedGps(raw);
  if (gps) return gps;

  const { query, countryCode } = cleanGeocodeQuery(raw, countryHint);
  // Prefer cleaned query, then fall back to scanning the raw place string
  const hit =
    (query ? gazetteerLookup(query) : null) ||
    gazetteerLookup(raw.replace(/,\s*[A-Z]{2}\s*$/i, "").trim());
  if (!hit) return null;
  return { ...hit, countryCode: hit.countryCode || countryCode };
}

export async function geocodePlace(
  raw: string,
  countryHint?: string | null,
): Promise<GeocodeResult | null> {
  const gps = extractEmbeddedGps(raw);
  if (gps) return gps;

  const { query, countryCode } = cleanGeocodeQuery(raw, countryHint);
  if (!query) return null;

  const local =
    gazetteerLookup(query) ||
    gazetteerLookup(raw.replace(/,\s*[A-Z]{2}\s*$/i, "").trim());
  if (local) return { ...local, countryCode: local.countryCode || countryCode };

  return nominatimSearch(query, countryCode);
}

type NominatimHit = {
  lat: string;
  lon: string;
  display_name?: string;
  boundingbox?: [string, string, string, string];
  class?: string;
  type?: string;
  address?: { country_code?: string };
};

const PLACE_TYPES = new Set([
  "city",
  "town",
  "village",
  "municipality",
  "hamlet",
  "suburb",
  "county",
  "state",
  "country",
  "region",
  "province",
  "administrative",
  "peak",
  "mountain_range",
  "wood",
  "lake",
  "reservoir",
  "national_park",
]);

function isPlaceLikeHit(hit: NominatimHit): boolean {
  if (hit.class === "boundary" && hit.type === "administrative") return true;
  if (hit.class === "place") return true;
  if (hit.class === "natural" || hit.class === "water" || hit.class === "waterway") return true;
  return PLACE_TYPES.has(hit.type || "");
}

function nominatimBounds(hit: NominatimHit): GeocodeResult["bounds"] {
  const bb = hit.boundingbox;
  if (!bb || bb.length < 4) return undefined;
  const south = Number(bb[0]);
  const north = Number(bb[1]);
  const west = Number(bb[2]);
  const east = Number(bb[3]);
  if (![south, north, west, east].every(Number.isFinite)) return undefined;
  return { west, south, east, north };
}

function hitToResult(hit: NominatimHit, countryCode?: string): GeocodeResult | null {
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!isInEuropeMap(lat, lng)) return null;
  const cc = (hit.address?.country_code || countryCode || "").toUpperCase() || undefined;
  if (isOmittedMapCountry(cc)) return null;
  const bounds = nominatimBounds(hit) ?? boundsFromRadiusKm(lng, lat, 80);
  return {
    lat,
    lng,
    displayName: hit.display_name,
    countryCode: cc,
    bounds,
  };
}

const publicPlaceCache = new Map<string, GeocodeResult | null>();
let lastNominatimAt = 0;

async function nominatimPublicSearch(query: string): Promise<GeocodeResult | null> {
  const wait = 1100 - (Date.now() - lastNominatimAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimAt = Date.now();

  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "5",
    addressdetails: "1",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      "User-Agent": "StartlineBot/0.1 (race calendar; contact@startline.app)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as NominatimHit[];
  if (!data?.length) return null;

  const inEurope = data
    .map((hit) => ({ hit, result: hitToResult(hit) }))
    .filter((row): row is { hit: NominatimHit; result: GeocodeResult } => row.result != null);

  const placeLike = inEurope.find((row) => isPlaceLikeHit(row.hit));
  return (placeLike ?? inEurope[0])?.result ?? null;
}

/**
 * Public search box: country / vacation destination / town, never forced to CZ.
 * Does not use `cleanGeocodeQuery`'s CZ default — that is for ingest pinning.
 */
export async function geocodePublicPlace(raw: string): Promise<GeocodeResult | null> {
  const q = raw.replace(/\s+/g, " ").trim();
  if (q.length < 3) return null;
  if (isPlaceSearchStopword(q)) return null;

  const cacheKey = fold(q);
  if (publicPlaceCache.has(cacheKey)) return publicPlaceCache.get(cacheKey) ?? null;

  const coverage = resolveCoveragePlace(q);
  if (coverage) {
    const hit: GeocodeResult = {
      lat: coverage.lat,
      lng: coverage.lng,
      countryCode: coverage.countryCode,
      displayName: coverage.displayName,
      bounds: coverage.bounds,
    };
    publicPlaceCache.set(cacheKey, hit);
    return hit;
  }

  const local = gazetteerLookup(q);
  if (local) {
    const hit: GeocodeResult = {
      ...local,
      bounds: boundsFromRadiusKm(local.lng, local.lat, 80),
    };
    publicPlaceCache.set(cacheKey, hit);
    return hit;
  }

  const remote = await nominatimPublicSearch(q);
  publicPlaceCache.set(cacheKey, remote);
  return remote;
}

export type GeocodeBatchResult = {
  attempted: number;
  updated: number;
  failed: number;
  skipped: number;
};

/** Instant pass: fill all pending locations that match the built-in town list. */
export async function geocodePendingFromGazetteer(): Promise<GeocodeBatchResult> {
  const supabase = createServerSupabase();
  const { data: rows, error } = await supabase
    .from("locations")
    .select("id, name, municipality, country_code, geocode_query")
    .is("lat", null)
    .limit(2000);
  if (error) throw new Error(error.message);

  const result: GeocodeBatchResult = { attempted: 0, updated: 0, failed: 0, skipped: 0 };
  const byQuery = new Map<string, { geo: GeocodeResult; ids: string[] }>();

  const { shouldIngestByCountry } = await import("@/lib/geo/europe");

  for (const row of rows ?? []) {
    result.attempted += 1;
    if (!shouldIngestByCountry(row.country_code)) {
      await supabase
        .from("locations")
        .update({ geocode_status: "skipped", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      result.skipped += 1;
      continue;
    }
    const raw = (row.geocode_query || row.municipality || row.name || "").trim();
    const geo = geocodeFromGazetteer(raw, row.country_code);
    if (!geo) continue;
    const key = `${fold(cleanGeocodeQuery(raw, row.country_code).query)}|${geo.lat}|${geo.lng}`;
    const bucket = byQuery.get(key) ?? { geo, ids: [] };
    bucket.ids.push(row.id);
    byQuery.set(key, bucket);
  }

  const pinned = new Set<string>();

  async function pinLocations(
    ids: string[],
    geo: GeocodeResult,
    rename?: string,
  ) {
    const payload: Record<string, unknown> = {
      lat: geo.lat,
      lng: geo.lng,
      country_code: geo.countryCode || "CZ",
      geocode_status: "ok",
      updated_at: new Date().toISOString(),
    };
    if (rename) {
      payload.name = rename;
      payload.municipality = rename;
      payload.geocode_query = rename;
    }
    const { data } = await supabase.from("locations").update(payload).in("id", ids).select("id");
    result.updated += data?.length ?? 0;
    for (const id of ids) {
      pinned.add(id);
      try {
        await supabase.rpc("set_location_geog", {
          loc_id: id,
          lng: geo.lng,
          lat: geo.lat,
        });
      } catch {
        /* optional */
      }
    }
  }

  for (const { geo, ids } of byQuery.values()) {
    await pinLocations(ids, geo);
  }

  // Venue fields like "UCI C1" / "Unknown" — the town is in the race title.
  const leftover = (rows ?? []).filter((r) => !pinned.has(r.id));
  if (leftover.length) {
    const byLoc = new Map<string, string[]>();
    for (let i = 0; i < leftover.length; i += 200) {
      const chunk = leftover.slice(i, i + 200).map((r) => r.id);
      const { data: evs } = await supabase
        .from("events")
        .select("name, location_id")
        .in("location_id", chunk)
        .eq("visibility", "public");
      for (const ev of evs ?? []) {
        const id = ev.location_id as string;
        const list = byLoc.get(id) ?? [];
        list.push(String(ev.name));
        byLoc.set(id, list);
      }
    }
    for (const row of leftover) {
      const names = byLoc.get(row.id) ?? [];
      let hit: GeocodeResult | null = null;
      let label = "";
      for (const name of names) {
        hit = geocodeFromGazetteer(name, row.country_code);
        if (hit) {
          const cleaned = cleanGeocodeQuery(name, row.country_code);
          label = cleaned.query || name;
          break;
        }
      }
      if (!hit) continue;
      const garbage = /^(uci\s*(c[123]|cn)|unknown|silnice)$/i.test((row.name || "").trim());
      await pinLocations([row.id], hit, garbage ? label : undefined);
    }
  }

  return result;
}

/** Process pending locations (gazetteer first, then Nominatim with rate limit). */
export async function geocodePendingLocations(
  limit = 40,
  opts?: { gazetteerOnly?: boolean },
): Promise<GeocodeBatchResult> {
  // Always drain gazetteer matches first (fast)
  const gaz = await geocodePendingFromGazetteer();
  if (opts?.gazetteerOnly) return gaz;

  const supabase = createServerSupabase();
  const { data: rows, error } = await supabase
    .from("locations")
    .select(
      "id, name, municipality, country_code, geocode_query, geocode_status, events!inner(id, visibility, start_date)",
    )
    .is("lat", null)
    .in("geocode_status", ["pending", "failed"])
    .eq("events.visibility", "public")
    .gte("events.start_date", "2026-01-01")
    .limit(limit);

  if (error) throw new Error(error.message);

  const uniqueRows = [...new Map((rows ?? []).map((r) => [String(r.id), r])).values()];

  const result: GeocodeBatchResult = {
    attempted: gaz.attempted,
    updated: gaz.updated,
    failed: gaz.failed,
    skipped: gaz.skipped,
  };
  const seen = new Map<string, GeocodeResult | null>();
  let nominatimCalls = 0;
  const nominatimBudget = Math.min(limit, 80);

  const { shouldIngestByCountry } = await import("@/lib/geo/europe");

  for (const row of uniqueRows) {
    if (nominatimCalls >= nominatimBudget) break;
    if (!shouldIngestByCountry(row.country_code)) {
      await supabase
        .from("locations")
        .update({ geocode_status: "skipped", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      result.skipped += 1;
      continue;
    }
    const raw = (row.geocode_query || row.municipality || row.name || "").trim();
    const { query, countryCode } = cleanGeocodeQuery(raw, row.country_code);
    if (!query) {
      await supabase
        .from("locations")
        .update({ geocode_status: "skipped", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      result.skipped += 1;
      continue;
    }

    const cacheKey = `${fold(query)}|${countryCode}`;
    let geo = seen.get(cacheKey);
    if (geo === undefined) {
      geo = gazetteerLookup(query);
      if (!geo) {
        if (nominatimCalls > 0) await new Promise((r) => setTimeout(r, 1100));
        geo = await nominatimSearch(query, countryCode);
        nominatimCalls += 1;
      }
      seen.set(cacheKey, geo ?? null);
    }

    if (!geo) {
      await supabase
        .from("locations")
        .update({ geocode_status: "failed", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      result.failed += 1;
      continue;
    }

    await supabase
      .from("locations")
      .update({
        lat: geo.lat,
        lng: geo.lng,
        country_code: geo.countryCode || countryCode,
        geocode_status: "ok",
        geocode_query: query,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    result.updated += 1;

    if (row.municipality) {
      const { data: twins } = await supabase
        .from("locations")
        .update({
          lat: geo.lat,
          lng: geo.lng,
          country_code: geo.countryCode || countryCode,
          geocode_status: "ok",
          geocode_query: query,
          updated_at: new Date().toISOString(),
        })
        .is("lat", null)
        .neq("id", row.id)
        .eq("municipality", row.municipality)
        .select("id");
      if (twins?.length) result.updated += twins.length;
    }

    try {
      await supabase.rpc("set_location_geog", {
        loc_id: row.id,
        lng: geo.lng,
        lat: geo.lat,
      });
    } catch {
      /* optional RPC */
    }
  }

  return result;
}
