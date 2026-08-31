import { readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { agentSiteUrl, sha256Digest } from "@/lib/agent-discovery";

const SKILLS = [
  { name: "search-events", description: "Query the Let's Race public API to find cycling events." },
  { name: "auth", description: "Authenticate with Let's Race via Supabase OAuth." },
] as const;

function skillUrl(name: string): string {
  return `${agentSiteUrl()}/.well-known/agent-skills/${name}/SKILL.md`;
}

function skillDigest(name: string): string {
  const path = join(process.cwd(), "public", ".well-known", "agent-skills", name, "SKILL.md");
  const content = readFileSync(path, "utf8");
  return sha256Digest(content);
}

export function GET() {
  const index = {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: SKILLS.map((skill) => ({
      name: skill.name,
      type: "skill-md",
      description: skill.description,
      url: skillUrl(skill.name),
      digest: skillDigest(skill.name),
    })),
  };

  return NextResponse.json(index, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
