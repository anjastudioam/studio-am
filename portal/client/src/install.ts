// Chrome and Edge fire this once, early. Keep it so Settings can offer an Install button later.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

export function listenForInstall() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}
export const canInstall = () => deferred !== null;
export const subscribeInstall = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export async function runInstall() {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  listeners.forEach((l) => l());
}
export const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
