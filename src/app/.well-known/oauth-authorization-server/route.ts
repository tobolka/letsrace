import { GET as getOpenIdConfiguration } from "../openid-configuration/route";

export function GET() {
  return getOpenIdConfiguration();
}
