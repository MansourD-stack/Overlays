/** Thin fetch wrapper for the Jokko API: JSON in/out, French error messages surfaced as-is. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string
  ) {
    super(message);
  }
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body !== undefined || method !== "GET" ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : method !== "GET" ? "{}" : undefined,
    });
  } catch {
    throw new ApiError(0, "Connexion impossible. Vérifie ta connexion internet.", "network");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error ?? "Erreur inattendue.", json.code ?? "error");
  return json as T;
}
