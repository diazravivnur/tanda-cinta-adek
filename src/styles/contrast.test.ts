import { describe, it, expect } from "vitest";

function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace("#", "");
  const num = parseInt(cleanHex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getLuminance([r, g, b]: [number, number, number]): number {
  const [rl, gl, bl] = [r, g, b].map((val) => {
    const s = val / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hexToRgb(hex1));
  const lum2 = getLuminance(hexToRgb(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe("Pemeriksaan Kontras WCAG (tokens.css)", () => {
  const LIGHT_TOKENS = {
    bg: "#FFFFFF",
    surface: "#F5F5F7",
    text: "#0A0A0F",
    textMuted: "#545460",
    primary: "#C2185B",
    primaryText: "#FFFFFF",
    secondary: "#0057B8",
    secondaryText: "#FFFFFF",
    ok: "#0B6B2E",
    okText: "#FFFFFF",
    warn: "#8A5A00",
    warnText: "#FFFFFF",
    danger: "#B00020",
    dangerText: "#FFFFFF",
  };

  const DARK_TOKENS = {
    bg: "#0A0A0F",
    surface: "#16161F",
    text: "#FFFFFF",
    textMuted: "#A6A6B6",
    primary: "#FF5C8A",
    primaryText: "#0A0A0F",
    secondary: "#5CA8FF",
    secondaryText: "#0A0A0F",
    ok: "#4ADE80",
    okText: "#0A0A0F",
    warn: "#FFC24A",
    warnText: "#0A0A0F",
    danger: "#FF6B6B",
    dangerText: "#0A0A0F",
  };

  it("Mode Terang: teks utama, teks sekunder, dan semantik memenuhi WCAG AA/AAA", () => {
    const textOnBg = getContrastRatio(LIGHT_TOKENS.text, LIGHT_TOKENS.bg);
    const textOnSurface = getContrastRatio(LIGHT_TOKENS.text, LIGHT_TOKENS.surface);
    const mutedOnBg = getContrastRatio(LIGHT_TOKENS.textMuted, LIGHT_TOKENS.bg);
    const primaryOnBg = getContrastRatio(LIGHT_TOKENS.primary, LIGHT_TOKENS.bg);
    const textOnPrimary = getContrastRatio(LIGHT_TOKENS.primaryText, LIGHT_TOKENS.primary);
    const textOnSecondary = getContrastRatio(LIGHT_TOKENS.secondaryText, LIGHT_TOKENS.secondary);
    const okOnBg = getContrastRatio(LIGHT_TOKENS.ok, LIGHT_TOKENS.bg);
    const textOnOk = getContrastRatio(LIGHT_TOKENS.okText, LIGHT_TOKENS.ok);
    const warnOnBg = getContrastRatio(LIGHT_TOKENS.warn, LIGHT_TOKENS.bg);
    const dangerOnBg = getContrastRatio(LIGHT_TOKENS.danger, LIGHT_TOKENS.bg);
    const textOnDanger = getContrastRatio(LIGHT_TOKENS.dangerText, LIGHT_TOKENS.danger);

    // Verifikasi rasio
    expect(textOnBg).toBeGreaterThanOrEqual(7.0); // AAA
    expect(textOnSurface).toBeGreaterThanOrEqual(7.0); // AAA
    expect(mutedOnBg).toBeGreaterThanOrEqual(4.5); // AA
    expect(primaryOnBg).toBeGreaterThanOrEqual(4.5); // AA
    expect(textOnPrimary).toBeGreaterThanOrEqual(4.5); // AA
    expect(textOnSecondary).toBeGreaterThanOrEqual(4.5); // AA
    expect(okOnBg).toBeGreaterThanOrEqual(4.5); // AA
    expect(textOnOk).toBeGreaterThanOrEqual(4.5); // AA
    expect(warnOnBg).toBeGreaterThanOrEqual(4.5); // AA
    expect(dangerOnBg).toBeGreaterThanOrEqual(4.5); // AA
    expect(textOnDanger).toBeGreaterThanOrEqual(4.5); // AA
  });

  it("Mode Gelap: teks utama, teks sekunder, dan semantik memenuhi WCAG AA/AAA", () => {
    const textOnBg = getContrastRatio(DARK_TOKENS.text, DARK_TOKENS.bg);
    const textOnSurface = getContrastRatio(DARK_TOKENS.text, DARK_TOKENS.surface);
    const mutedOnBg = getContrastRatio(DARK_TOKENS.textMuted, DARK_TOKENS.bg);
    const primaryOnBg = getContrastRatio(DARK_TOKENS.primary, DARK_TOKENS.bg);
    const textOnPrimary = getContrastRatio(DARK_TOKENS.primaryText, DARK_TOKENS.primary);
    const textOnSecondary = getContrastRatio(DARK_TOKENS.secondaryText, DARK_TOKENS.secondary);
    const okOnBg = getContrastRatio(DARK_TOKENS.ok, DARK_TOKENS.bg);
    const textOnOk = getContrastRatio(DARK_TOKENS.okText, DARK_TOKENS.ok);
    const warnOnBg = getContrastRatio(DARK_TOKENS.warn, DARK_TOKENS.bg);
    const dangerOnBg = getContrastRatio(DARK_TOKENS.danger, DARK_TOKENS.bg);
    const textOnDanger = getContrastRatio(DARK_TOKENS.dangerText, DARK_TOKENS.danger);

    // Verifikasi rasio
    expect(textOnBg).toBeGreaterThanOrEqual(7.0); // AAA
    expect(textOnSurface).toBeGreaterThanOrEqual(7.0); // AAA
    expect(mutedOnBg).toBeGreaterThanOrEqual(4.5); // AA
    expect(primaryOnBg).toBeGreaterThanOrEqual(4.5); // AA
    expect(textOnPrimary).toBeGreaterThanOrEqual(4.5); // AA
    expect(textOnSecondary).toBeGreaterThanOrEqual(7.0); // AAA
    expect(okOnBg).toBeGreaterThanOrEqual(7.0); // AAA
    expect(textOnOk).toBeGreaterThanOrEqual(7.0); // AAA
    expect(warnOnBg).toBeGreaterThanOrEqual(7.0); // AAA
    expect(dangerOnBg).toBeGreaterThanOrEqual(4.5); // AA
    expect(textOnDanger).toBeGreaterThanOrEqual(4.5); // AA
  });
});

