const KEY = "realm-of-nash-survey";

type SurveySave = {
  step: number;
  fog: string | null;
};

const memory: SurveySave = { step: 0, fog: null };
let loaded = false;
let timer = 0;

function read(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<SurveySave>;
    if (typeof parsed.step === "number" && parsed.step >= 0) memory.step = parsed.step;
    if (typeof parsed.fog === "string") memory.fog = parsed.fog;
  } catch {
    /* private mode or a torn save */
  }
}

function flush(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* private mode */
  }
}

export function loadStep(): number {
  read();
  return memory.step;
}

export function loadFog(): string | null {
  read();
  return memory.fog;
}

export function saveStep(step: number): void {
  read();
  memory.step = step;
  flush();
}

export function saveFog(fog: string): void {
  read();
  memory.fog = fog;
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(flush, 400);
}
