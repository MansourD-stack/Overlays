import { describe, expect, it } from "vitest";
import { cleanName, moderateMessage, normalizeSenegalPhone, parseAmount, validateSlug } from "../validation";
import { nextRank, rankFor } from "../ranks";
import { parseForm } from "../http";

describe("normalizeSenegalPhone", () => {
  it.each([
    ["77 123 45 67", "+221771234567"],
    ["+221 76-123-45-67", "+221761234567"],
    ["00221701234567", "+221701234567"],
    ["221781234567", "+221781234567"],
  ])("accepte %s", (input, expected) => expect(normalizeSenegalPhone(input)).toBe(expected));

  it.each(["", "12345", "33 123 45 67", "+33612345678", "7712345678"])("refuse %s", (input) => expect(normalizeSenegalPhone(input)).toBeNull());
});

describe("parseAmount", () => {
  it("accepte un entier dans les bornes, y compris avec espaces", () => expect(parseAmount("1 000", 200, 5000)).toBe(1000));
  it("refuse décimales, trop petit, trop grand", () => {
    expect(() => parseAmount(10.5, 200, 5000)).toThrow();
    expect(() => parseAmount(100, 200, 5000)).toThrow(/minimum/);
    expect(() => parseAmount(9000, 200, 5000)).toThrow(/maximum/);
  });
});

describe("moderation", () => {
  it("retire les liens, masque les mots bloqués, limite la longueur", () => {
    const msg = moderateMessage("Va sur https://spam.example et www.x.com, fdp ! mot-perso", ["perso"]);
    expect(msg).not.toMatch(/https|www/);
    expect(msg).toContain("[lien]");
    expect(msg).toContain("***");
    expect(msg).toContain("mot-*****");
    expect(moderateMessage("a".repeat(500))).toHaveLength(140);
  });
  it("ne masque pas un mot bloqué à l'intérieur d'un autre mot", () => {
    expect(moderateMessage("reputation", [])).toBe("reputation");
  });
  it("nom par défaut Anonyme", () => {
    expect(cleanName("   ")).toBe("Anonyme");
    expect(cleanName("A\u0000wa")).toBe("A wa");
  });
});

describe("slug", () => {
  it("valide et normalise", () => expect(validateSlug("Mon-Stream")).toBe("mon-stream"));
  it("refuse les réservés et formats invalides", () => {
    expect(() => validateSlug("admin")).toThrow();
    expect(() => validateSlug("a")).toThrow();
    expect(() => validateSlug("-abc")).toThrow();
  });
});

describe("rangs Teranga", () => {
  it("paliers", () => {
    expect(rankFor(0).id).toBe("bronze");
    expect(rankFor(10_000).id).toBe("argent");
    expect(rankFor(60_000).id).toBe("or");
    expect(rankFor(200_000).id).toBe("diamant");
    expect(nextRank(9_000)).toEqual({ rank: expect.objectContaining({ id: "argent" }), missing: 1_000 });
    expect(nextRank(500_000)).toBeNull();
  });
});

describe("parseForm (IPN PayDunya)", () => {
  it("reconstruit les objets imbriqués et ignore __proto__", () => {
    const out = parseForm("data%5Bhash%5D=abc&data%5Binvoice%5D%5Btoken%5D=tok&data%5B__proto__%5D%5Bx%5D=1");
    expect(out).toEqual({ data: { hash: "abc", invoice: { token: "tok" } } });
    expect(({} as any).x).toBeUndefined();
  });
});
