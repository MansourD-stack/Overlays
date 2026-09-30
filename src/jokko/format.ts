const NUM = new Intl.NumberFormat("fr-FR");
const DATE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const fcfa = (n: number) => `${NUM.format(n)} F`;
export const dateTime = (ts: number) => DATE.format(new Date(ts));

export const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  completed: "Confirmé",
  failed: "Échoué",
  cancelled: "Annulé",
  paid: "Versé",
  rejected: "Refusé",
};

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "J"
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
