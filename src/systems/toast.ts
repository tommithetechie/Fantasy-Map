let timer = 0;

export function showToasts(messages: readonly string[]): void {
  const toast = document.getElementById("toast");
  if (!toast) return;
  const text = messages.filter((message) => message.length > 0).join(" · ");
  if (!text) return;
  toast.textContent = text;
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(() => toast.classList.remove("show"), 3400);
}
