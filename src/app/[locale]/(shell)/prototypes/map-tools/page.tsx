"use client";
import { useState } from "react";
import { LightRaceMap } from "@/components/map/light-race-map";
import { RadiusMap } from "@/components/account/radius-map";
export default function MapToolsFixture() {
  const [radius, setRadius] = useState(50);
  const [denied, setDenied] = useState(false);
  return <div className="mx-auto max-w-4xl space-y-5 p-6">
    <h1>Local map interaction fixture</h1>
    <button onClick={() => {
      sessionStorage.setItem("letsrace.origin.v1", JSON.stringify({ lat: 49.1951, lng: 16.6068 }));
      location.assign("/en?radius=50&dateFrom=2026-10-17&dateTo=2026-10-17");
    }}>Test distance from Brno</button>
    <button onClick={() => {
      const geolocation: Geolocation = {
        getCurrentPosition: (_success, failure) => failure?.({ code: 1, message: "Test denial", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
        watchPosition: () => 0, clearWatch: () => {},
      };
      Object.defineProperty(navigator, "geolocation", { value: geolocation, configurable: true });
      setDenied(true);
    }}>Test denied location</button>
    {denied && <div className="h-96"><LightRaceMap events={[]} onSelect={()=>{}} onBoundsChange={()=>{}} skipInitialLocate locale="en" /></div>}
    <div className="flex gap-4">{[10,25,50,100,200].map((km)=><button key={km} onClick={()=>setRadius(km)}>{km} km</button>)}</div>
    <RadiusMap lat={49.1951} lng={16.6068} radiusKm={radius} label={`Test area ${radius} km`} className="h-96 rounded-xl border" races={[]} />
  </div>;
}
