import { createServerSupabase } from "@/lib/supabase/server";

export type GeocodeResult = {
  lat: number;
  lng: number;
  displayName?: string;
  countryCode?: string;
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
  "teplice nad metuji": { lat: 50.5936, lng: 16.1703, cc: "CZ" },
  "teplice nad metují": { lat: 50.5936, lng: 16.1703, cc: "CZ" },
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
  hulst: { lat: 51.358, lng: 4.091, cc: "NL" },
  "val di fassa": { lat: 46.43, lng: 11.68, cc: "IT" },
  "la thuile": { lat: 45.714, lng: 6.913, cc: "IT" },
  "lake placid": { lat: 44.2795, lng: -73.9799, cc: "US" },
  "soldier hollow": { lat: 40.483, lng: -111.495, cc: "US" },
  midway: { lat: 40.512, lng: -111.474, cc: "US" },
  whistler: { lat: 50.1163, lng: -122.9574, cc: "CA" },
  "bellwald": { lat: 46.425, lng: 8.16, cc: "CH" },
  "aletch arena": { lat: 46.39, lng: 8.08, cc: "CH" },
  salzkammergut: { lat: 47.7, lng: 13.6, cc: "AT" },
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
};

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bn\//g, "nad ")
    .replace(/[_/]+/g, " ")
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
  { re: /\b(netherlands|nizozemsko|holland)\b/i, cc: "NL" },
  { re: /\b(germany|deutschland|německo|nemecko)\b/i, cc: "DE" },
  { re: /\b(austria|österreich|rakousko)\b/i, cc: "AT" },
  { re: /\b(switzerland|schweiz|švýcarsko|svycarsko)\b/i, cc: "CH" },
  { re: /\b(slovakia|slovensko)\b/i, cc: "SK" },
  { re: /\b(poland|polsko)\b/i, cc: "PL" },
  { re: /\b(italy|italien|italsko)\b/i, cc: "IT" },
  { re: /\b(france|frankreich|francie)\b/i, cc: "FR" },
  { re: /\b(belgium|belgie)\b/i, cc: "BE" },
  { re: /\b(spain|spanien|španělsko)\b/i, cc: "ES" },
  { re: /\b(portugal)\b/i, cc: "PT" },
  { re: /\b(japan|japonsko)\b/i, cc: "JP" },
  { re: /\b(south africa)\b/i, cc: "ZA" },
  { re: /\b(czechia|czech republic|česko|cesko)\b/i, cc: "CZ" },
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
      /,\s*(CZ|SK|DE|AT|PL|IT|FR|CH|BE|ES|PT|JP|ZA|HU|NL|GB|UK|US|CA|CN|CL|AD|KR)\s*$/gi,
      "",
    )
    .replace(/,\s*(new york|ny|utah|sardinia|valais|british columbia)\s*$/i, "")
    .trim();

  // Drop date fragments: "5-6/9", "27/6", "15/8", "16/5"
  text = text.replace(/\b\d{1,2}([-–/]\d{1,2}){1,2}(\/\d{2,4})?\b/g, " ");

  // Drop event-title noise
  text = text
    .replace(/^(partnersk[aá]\s+akce\s*[-–:]?\s*)/i, "")
    .replace(/\b(bikemaraton|bike\s*maraton|maraton|trophy|classic|cup|tour|race of|nova sport junior)\b/gi, " ")
    .replace(/^(xce|xco|xcc|xcm|xc|dh|edr|mtb|uci|cn|c1|c2|c3)\s+/i, "")
    .replace(/\b(areal|areál|ski|letiště|letiste|kláštera|klasatera|traily|lesopark|kategorie|prestige)\b/gi, " ")
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
    const last = dashParts[dashParts.length - 1]!.trim();
    const first = dashParts[0]!.trim();
    primary = last.length >= 3 ? last : first;
  } else {
    primary = primary.split(/\(/)[0]?.trim() || primary;
  }
  // If still "City, Something", keep first comma segment (often the place)
  if (primary.includes(",")) {
    primary = primary.split(",")[0]!.trim();
  }
  primary = primary.replace(/\s+/g, " ").replace(/^[\s,.-]+|[\s,.-]+$/g, "").trim();

  // Reject garbage / category-only labels
  if (
    !primary ||
    primary.length < 2 ||
    /^(uci(\s+(c1|c2|c3|cn))?|cn|c1|c2|c3|czech|czechia|unknown|silnice|—|-)$/i.test(
      primary,
    ) ||
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

  for (const row of rows ?? []) {
    result.attempted += 1;
    const raw = (row.geocode_query || row.municipality || row.name || "").trim();
    const geo = geocodeFromGazetteer(raw, row.country_code);
    if (!geo) continue;
    const key = `${fold(cleanGeocodeQuery(raw, row.country_code).query)}|${geo.lat}|${geo.lng}`;
    const bucket = byQuery.get(key) ?? { geo, ids: [] };
    bucket.ids.push(row.id);
    byQuery.set(key, bucket);
  }

  for (const { geo, ids } of byQuery.values()) {
    const { data } = await supabase
      .from("locations")
      .update({
        lat: geo.lat,
        lng: geo.lng,
        country_code: geo.countryCode || "CZ",
        geocode_status: "ok",
        updated_at: new Date().toISOString(),
      })
      .in("id", ids)
      .select("id");
    result.updated += data?.length ?? 0;
    for (const id of ids) {
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
    .select("id, name, municipality, country_code, geocode_query, geocode_status")
    .is("lat", null)
    .in("geocode_status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  const result: GeocodeBatchResult = {
    attempted: gaz.attempted,
    updated: gaz.updated,
    failed: gaz.failed,
    skipped: gaz.skipped,
  };
  const seen = new Map<string, GeocodeResult | null>();
  let nominatimCalls = 0;
  const nominatimBudget = Math.min(limit, 25);

  for (const row of rows ?? []) {
    if (nominatimCalls >= nominatimBudget) break;
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
