// One frame of the Music player's visualizer: frequency bars and a
// waveform line over a dark panel, or an idle pattern without audio data.

export interface VisualizerFrame {
  /** Music plays (bars pulse harder, the line is brighter). */
  playing: boolean;
  /** Levels come from a running analyser; otherwise the idle pattern shows. */
  hasAudioData: boolean;
  frequencyData: Uint8Array | null;
  waveformData: Uint8Array | null;
  /** Advances while the visualizer animates. */
  phase: number;
}

export function drawVisualizer(context: CanvasRenderingContext2D, frame: VisualizerFrame) {
  const { playing, hasAudioData, frequencyData, waveformData, phase } = frame;
  const { width, height } = context.canvas;
  const center = height * 0.58;
  const barCount = 40;
  const gap = 4;
  const barWidth = (width - gap * (barCount - 1)) / barCount;
  const gradient = context.createLinearGradient(0, 18, 0, height);

  context.clearRect(0, 0, width, height);

  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "rgba(6, 13, 24, 0.58)");
  background.addColorStop(1, "rgba(18, 32, 48, 0.32)");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.globalAlpha = 0.28;
  context.strokeStyle = "rgba(125, 240, 255, 0.25)";
  context.lineWidth = 1;
  for (let y = 24; y < height; y += 28) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.globalAlpha = 1;

  gradient.addColorStop(0, "rgba(247, 211, 96, 0.95)");
  gradient.addColorStop(0.42, "rgba(79, 224, 200, 0.92)");
  gradient.addColorStop(1, "rgba(119, 152, 255, 0.48)");
  context.fillStyle = gradient;
  context.shadowBlur = 18;
  context.shadowColor = "rgba(79, 224, 200, 0.45)";

  for (let index = 0; index < barCount; index += 1) {
    const sourceIndex = frequencyData
      ? Math.min(frequencyData.length - 1, Math.floor((index / barCount) * frequencyData.length))
      : index;
    const frequencyLevel = frequencyData?.[sourceIndex] ?? 0;
    const idleLevel = 28 + Math.sin(phase + index * 0.55) * 12 + Math.cos(phase * 0.65 + index * 0.28) * 8;
    const normalizedLevel = playing && hasAudioData ? frequencyLevel / 255 : idleLevel / 100;
    const pulse = playing ? Math.max(0.12, normalizedLevel) : Math.max(0.08, normalizedLevel * 0.52);
    const barHeight = Math.max(8, pulse * (height - 34));
    const x = index * (barWidth + gap);
    const y = center - barHeight / 2;
    const radius = Math.min(8, barWidth / 2);

    context.beginPath();
    context.roundRect(x, y, barWidth, barHeight, radius);
    context.fill();
  }

  context.shadowBlur = 0;
  context.globalAlpha = playing ? 0.92 : 0.42;
  context.strokeStyle = "rgba(247, 211, 96, 0.72)";
  context.lineWidth = 2;
  context.beginPath();
  for (let x = 0; x <= width; x += 12) {
    const waveformIndex = waveformData
      ? Math.min(waveformData.length - 1, Math.floor((x / width) * waveformData.length))
      : 0;
    const frequencyIndex = frequencyData
      ? Math.min(frequencyData.length - 1, Math.floor((x / width) * frequencyData.length))
      : 0;
    const waveform = waveformData
      ? (waveformData[waveformIndex] - 128) / 128
      : Math.sin(phase * 1.6 + x * 0.028) * 0.35;
    const energy = frequencyData?.[frequencyIndex] ? frequencyData[frequencyIndex] / 255 : 0.22;
    const y = center + waveform * (8 + energy * 24) * (playing ? 1 : 0.42);
    if (x === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();
  context.globalAlpha = 1;
}
