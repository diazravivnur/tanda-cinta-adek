import { describe, it, expect } from "vitest";
import {
  computeSessionId,
  getActiveSession,
  resolveOpenContraction,
  isContractionStallyOpen,
  computeNewIntervalSec,
} from "./sessionUtils";
import type { Contraction } from "../../types";

const BASE = 1_700_000_000_000;

function makeC(
  id: string,
  startAt: number,
  endAt: number | null = startAt + 60_000,
  sessionId = "s_test"
): Contraction {
  return {
    id,
    sessionId,
    startAt,
    endAt,
    durationSec: endAt !== null ? Math.round((endAt - startAt) / 1000) : null,
    intervalSec: null,
    createdBy: "uid-wulan",
  };
}

describe("computeSessionId", () => {
  it("membuat ID deterministik dari epoch ms", () => {
    expect(computeSessionId(1_700_000_000_000)).toBe("s_1700000000000");
    expect(computeSessionId(0)).toBe("s_0");
  });

  it("menghasilkan ID yang sama untuk input yang sama", () => {
    const id = computeSessionId(BASE);
    expect(computeSessionId(BASE)).toBe(id);
  });
});

describe("getActiveSession", () => {
  it("mengembalikan null jika daftar kosong", () => {
    expect(getActiveSession([], BASE)).toBeNull();
  });

  it("mengembalikan sesi aktif jika gap <= SESSION_GAP_MIN", () => {
    const c1 = makeC("c1", BASE);
    const c2 = makeC("c2", BASE + 300_000);
    const now = BASE + 300_000 + 55 * 60 * 1000; // 55 menit setelah c2
    const result = getActiveSession([c1, c2], now);
    expect(result).not.toBeNull();
    expect(result!.contractions).toHaveLength(2);
  });

  it("mengembalikan null jika gap tepat > 60 menit", () => {
    const c1 = makeC("c1", BASE);
    // Tepat 60 menit + 1 detik setelah c1
    const now = BASE + 60 * 60 * 1000 + 1000;
    expect(getActiveSession([c1], now)).toBeNull();
  });

  it("TIDAK memisahkan sesi jika gap tepat 60 menit", () => {
    const c1 = makeC("c1", BASE);
    const now = BASE + 60 * 60 * 1000; // Tepat 60 menit
    expect(getActiveSession([c1], now)).not.toBeNull();
  });

  it("menggunakan sesi terakhir (bukan sesi lama)", () => {
    const s1 = makeC("s1c1", BASE, BASE + 60_000, "s_old");
    // Jeda 75 menit → sesi baru
    const s2Base = BASE + 75 * 60 * 1000;
    const s2 = makeC("s2c1", s2Base, s2Base + 65_000, "s_new");
    const now = s2Base + 5 * 60 * 1000;

    const result = getActiveSession([s1, s2], now);
    expect(result).not.toBeNull();
    expect(result!.contractions[0].id).toBe("s2c1");
  });
});

describe("resolveOpenContraction", () => {
  it("mengembalikan null jika tidak ada kontraksi terbuka", () => {
    const c1 = makeC("c1", BASE, BASE + 60_000);
    expect(resolveOpenContraction([c1])).toBeNull();
  });

  it("menemukan kontraksi terbuka (endAt null)", () => {
    const c1 = makeC("c1", BASE, BASE + 60_000);
    const c2 = makeC("c2", BASE + 300_000, null);
    const result = resolveOpenContraction([c1, c2]);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("c2");
  });

  it("jika ada beberapa kontraksi terbuka, ambil yang paling baru", () => {
    const c1 = makeC("c1", BASE, null);
    const c2 = makeC("c2", BASE + 300_000, null);
    const result = resolveOpenContraction([c1, c2]);
    expect(result!.id).toBe("c2");
  });
});

describe("isContractionStallyOpen", () => {
  it("kontraksi yang belum 5 menit tidak dianggap 'stally'", () => {
    const c = makeC("c1", BASE, null);
    const now = BASE + 4 * 60 * 1000 + 59_000; // 4 menit 59 detik
    expect(isContractionStallyOpen(c, now)).toBe(false);
  });

  it("kontraksi yang sudah > 5 menit dianggap stally", () => {
    const c = makeC("c1", BASE, null);
    const now = BASE + 5 * 60 * 1000 + 1000; // 5 menit 1 detik
    expect(isContractionStallyOpen(c, now)).toBe(true);
  });

  it("kontraksi yang sudah berakhir (endAt !== null) tidak pernah stally", () => {
    const c = makeC("c1", BASE, BASE + 60_000);
    const now = BASE + 60 * 60 * 1000; // 1 jam kemudian
    expect(isContractionStallyOpen(c, now)).toBe(false);
  });
});

describe("computeNewIntervalSec", () => {
  it("mengembalikan null jika tidak ada kontraksi sebelumnya", () => {
    expect(computeNewIntervalSec(BASE, null)).toBeNull();
  });

  it("menghitung interval dari startAt kontraksi sebelumnya", () => {
    const prev = makeC("c1", BASE);
    const newStart = BASE + 300_000; // 5 menit kemudian
    expect(computeNewIntervalSec(newStart, prev)).toBe(300);
  });
});

