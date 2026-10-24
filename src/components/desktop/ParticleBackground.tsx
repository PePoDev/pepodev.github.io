"use client";
// #bg-canvas, the desktop background (particles.ts), driven by the
// preferences and the site mode.
import { useEffect, useRef } from "react";
import { startParticleNetwork, type ParticleNetwork } from "./particles";
import { useDesktopPrefs } from "./prefs";
import { useSiteMode } from "./site-mode";

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const network = useRef<ParticleNetwork | null>(null);
  const prefs = useDesktopPrefs();
  const siteMode = useSiteMode();

  useEffect(() => {
    if (!canvasRef.current) return;
    network.current = startParticleNetwork(canvasRef.current);
    return () => {
      network.current?.destroy();
      network.current = null;
    };
  }, []);

  useEffect(() => {
    if (prefs) network.current?.setPreferences(prefs.backgroundEffect !== false);
  }, [prefs]);

  useEffect(() => {
    if (siteMode) network.current?.setSiteMode(siteMode);
  }, [siteMode]);

  return <canvas id="bg-canvas" ref={canvasRef} />;
}
