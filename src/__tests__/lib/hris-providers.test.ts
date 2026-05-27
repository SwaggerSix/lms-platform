import { describe, it, expect } from "vitest";
import {
  getHRISProvider,
  listHRISProviders,
  BambooHRProvider,
  GenericRESTProvider,
} from "@/lib/integrations/hris/providers";

/**
 * Unit tests for the HRIS provider registry — pure lookup + the
 * error path for an unknown provider type. Previously untested.
 */

describe("getHRISProvider", () => {
  it("returns a BambooHRProvider for 'bamboohr'", () => {
    expect(getHRISProvider("bamboohr")).toBeInstanceOf(BambooHRProvider);
  });

  it("returns a GenericRESTProvider for 'generic_rest'", () => {
    expect(getHRISProvider("generic_rest")).toBeInstanceOf(GenericRESTProvider);
  });

  it("throws a descriptive error for an unknown type, listing the known ones", () => {
    expect(() => getHRISProvider("workday")).toThrowError(/Unknown HRIS provider type: "workday"/);
    expect(() => getHRISProvider("workday")).toThrowError(/bamboohr/);
    expect(() => getHRISProvider("workday")).toThrowError(/generic_rest/);
  });

  it("returns a fresh instance each call (factory, not singleton)", () => {
    expect(getHRISProvider("bamboohr")).not.toBe(getHRISProvider("bamboohr"));
  });
});

describe("listHRISProviders", () => {
  it("lists the registered provider types", () => {
    expect(listHRISProviders().sort()).toEqual(["bamboohr", "generic_rest"]);
  });

  it("stays in sync with getHRISProvider (every listed type resolves)", () => {
    for (const type of listHRISProviders()) {
      expect(() => getHRISProvider(type)).not.toThrow();
    }
  });
});
