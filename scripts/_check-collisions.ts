import { readFileSync } from "fs";
import { resolve } from "path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import { createServerSupabase } from "../src/lib/supabase/server";

async function main() {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("series")
    .select("id,slug,name,website_url,country_code,disciplines")
    .or(
      [
        "website_url.ilike.%cyklistikaszc%",
        "website_url.ilike.%pzkol.pl%",
        "website_url.ilike.%xco-nrw%",
        "website_url.ilike.%lines-mag%",
        "website_url.ilike.%mountainbike-challenge%",
        "slug.ilike.%slovensky%",
        "slug.ilike.%puchar-polski%",
        "slug.eq.spdh",
        "slug.eq.spen",
        "slug.eq.slovensky-pohar-xco",
        "slug.eq.austrian-gravity-series",
        "slug.ilike.%schneef%",
        "slug.ilike.%nrw%",
      ].join(","),
    )
    .order("slug");
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
  console.log("count", data?.length);
}
main();
