type Tick = (now: number, dt: number) => void;

const ticks: Tick[] = [];
let raf = 0;
let last = 0;

export function onFrame(tick: Tick): void {
  ticks.push(tick);
}

function frame(now: number): void {
  raf = requestAnimationFrame(frame);
  const dt = last === 0 ? 0 : Math.min(0.05, (now - last) / 1000);
  last = now;
  for (let i = 0; i < ticks.length; i++) ticks[i](now, dt);
}

export function startLoop(): void {
  if (raf !== 0) return;
  last = 0;
  raf = requestAnimationFrame(frame);
}

function stopLoop(): void {
  if (raf === 0) return;
  cancelAnimationFrame(raf);
  raf = 0;
  last = 0;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopLoop();
  else startLoop();
});
