// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/gems/auth", () => ({ getAccessToken: async () => "token" }));

import { gemsDatePart, gemsTimePart, resolveRefs } from "@/lib/integrations/gems/client";
import { gemsAdapter, mapStatus, normalizeEvent } from "@/lib/integrations/gems/adapter";
import { buildInstructorMap, escapeLike } from "@/lib/integrations/gems/sync";
import type { GemsConfig, GemsTrainingEvent } from "@/lib/integrations/gems/types";

describe("gemsDatePart", () => {
  it("takes the date from the string, not through the server's time zone", () => {
    expect(gemsDatePart("2026-05-04T00:00:00")).toBe("2026-05-04");
    expect(gemsDatePart("2026-05-04T23:30:00-05:00")).toBe("2026-05-04");
  });
  it("reads DateTime.MinValue and junk as unset", () => {
    expect(gemsDatePart("0001-01-01T00:00:00")).toBeNull();
    expect(gemsDatePart("")).toBeNull();
    expect(gemsDatePart(undefined)).toBeNull();
  });
});

describe("gemsTimePart", () => {
  it("keeps a time of day carried on DateTime.MinValue's date", () => {
    // .NET time-only values commonly ride on 0001-01-01; these used to be dropped.
    expect(gemsTimePart("0001-01-01T09:30:00")).toBe("09:30:00");
  });
  it("reads a time from a full datetime", () => {
    expect(gemsTimePart("2026-05-04T13:15:00")).toBe("13:15:00");
    expect(gemsTimePart("2026-05-04T13:15")).toBe("13:15:00");
  });
  it("reads a bare MinValue and junk as unset", () => {
    expect(gemsTimePart("0001-01-01T00:00:00")).toBeNull();
    expect(gemsTimePart("09:30")).toBeNull();
    expect(gemsTimePart(null)).toBeNull();
  });
});

describe("mapStatus", () => {
  it("marks a scheduled class completed once its end date has passed", () => {
    expect(mapStatus("Scheduled", "2026-05-05", "2026-10-13")).toBe("completed");
    expect(mapStatus("Scheduled", "2026-10-13", "2026-10-13")).toBe("scheduled");
    expect(mapStatus("Scheduled", "2026-12-01", "2026-10-13")).toBe("scheduled");
  });
  it("keeps cancelled classes cancelled, past or not", () => {
    expect(mapStatus("Canceled", "2026-05-05", "2026-10-13")).toBe("cancelled");
    expect(mapStatus("Cancelled")).toBe("cancelled");
  });
  it("leaves postponed, tentative and development classes scheduled", () => {
    for (const s of ["Postponed", "Tentative", "Development"]) expect(mapStatus(s, "2026-05-05", "2026-10-13")).toBe("scheduled");
  });
});

const raw = {
  eventId: 2548,
  eventCode: "2026-049",
  courseStatus: "Scheduled",
  startDate: "2026-05-04T00:00:00",
  endDate: "2026-05-05T00:00:00",
  startTime: "0001-01-01T08:30:00",
  endTime: "0001-01-01T16:30:00",
  courseProduct: { courseProductId: 1, productDescription: "PM Basics", productCode: "PM101", min: 5, max: 24, sinnumber: "" },
  customer: null,
  instructor: { instructorId: 7, firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
  courseLocation: { locationName: "Bldg 3", city: "Cleveland", state: "OH", zip: "44135", isVirtual: false },
  noOfStudents: 18,
  roster: true,
} as unknown as GemsTrainingEvent;

describe("normalizeEvent", () => {
  it("maps dates, real times and a delivered class's status", () => {
    expect(normalizeEvent(raw, "2026-10-13")).toMatchObject({
      external_id: "2548",
      session_date: "2026-05-04",
      start_time: "08:30:00",
      end_time: "16:30:00",
      status: "completed",
      max_capacity: 24,
      instructor_name: "Jane Doe",
      instructor_external_id: 7,
      location_type: "in_person",
    });
  });
  it("judges a one-day class without an end date by its start date", () => {
    const oneDay = { ...raw, endDate: "0001-01-01T00:00:00" } as GemsTrainingEvent;
    expect(normalizeEvent(oneDay, "2026-10-13")?.status).toBe("completed");
  });
  it("keeps the customer, to tell same-day roster folders apart", () => {
    const withCustomer = { ...raw, customer: { customerId: 3, customerName: "Department of Energy", customerCode: "DOE" } } as GemsTrainingEvent;
    expect(normalizeEvent(withCustomer, "2026-10-13")).toMatchObject({ customer_name: "Department of Energy", customer_code: "DOE" });
    expect(normalizeEvent(raw, "2026-10-13")).toMatchObject({ customer_name: undefined, customer_code: undefined });
  });
  it("skips an event without a start date", () => {
    expect(normalizeEvent({ ...raw, startDate: "0001-01-01T00:00:00" } as GemsTrainingEvent)).toBeNull();
  });
});

describe("escapeLike", () => {
  it("escapes LIKE wildcards so a title matches only itself", () => {
    expect(escapeLike("100% Leadership_101")).toBe("100\\% Leadership\\_101");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });
});

describe("gemsAdapter.fetchEvents", () => {
  afterEach(() => vi.unstubAllGlobals());
  const config = { api_base: "https://gems.test" } as GemsConfig;

  function stubGems(byYear: Record<string, { rows: unknown[]; totalCount?: number }>) {
    const bodies: { earliestDate: string; lastDate: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      const hit = byYear[body.earliestDate.slice(0, 4)] ?? { rows: [] };
      return Response.json({ queryResults: { $values: hit.rows }, totalCount: hit.totalCount ?? hit.rows.length });
    }));
    return bodies;
  }

  it("searches one calendar year at a time, through five years ahead", async () => {
    const bodies = stubGems({ "2026": { rows: [raw] } });
    const { events, warnings } = await gemsAdapter.fetchEvents(config, { fromYear: 2025, today: "2026-10-13" });
    expect(bodies.map((b) => b.earliestDate)).toEqual(
      ["2025", "2026", "2027", "2028", "2029", "2030", "2031"].map((y) => `${y}-01-01T00:00:00`),
    );
    expect(bodies[0].lastDate).toBe("2025-12-31T23:59:59");
    expect(events.map((e) => e.external_id)).toEqual(["2548"]);
    expect(warnings).toEqual([]);
  });

  it("warns when GEMS reports more events than it returned", async () => {
    stubGems({ "2026": { rows: [raw], totalCount: 40 } });
    const { warnings } = await gemsAdapter.fetchEvents(config, { fromYear: 2026, today: "2026-10-13" });
    expect(warnings).toEqual(["GEMS returned 1 of 40 events for 2026; the rest were not synced"]);
  });

  it("keeps one copy of an event that spans a year boundary", async () => {
    stubGems({ "2026": { rows: [raw] }, "2027": { rows: [raw] } });
    const { events } = await gemsAdapter.fetchEvents(config, { fromYear: 2026, today: "2026-10-13" });
    expect(events).toHaveLength(1);
  });
});

describe("resolveRefs", () => {
  // The shape of a real GEMS search: the customer and instructor are written
  // under the first event, and the second event only references them.
  const response = {
    queryResults: {
      $id: "1",
      $values: [
        {
          $id: "2",
          eventId: 2605,
          instructor: { $id: "3", instructorId: 7, email: "jane@example.com" },
          customer: { $id: "4", customerCode: "NAVFAC", customersPos: { $id: "5", $values: [{ $ref: "6" }] } },
          customersPo: { $id: "6", cpoId: 214, customer: { $ref: "4" } },
        },
        { $id: "7", eventId: 2606, instructor: { $ref: "3" }, customer: { $ref: "4" } },
      ],
    },
  };

  it("replaces references with their targets across events and cuts cycles", () => {
    const out = resolveRefs(response) as { queryResults: { $values: Record<string, unknown>[] } };
    const [first, second] = out.queryResults.$values;
    expect(second).toMatchObject({ instructor: { email: "jane@example.com" }, customer: { customerCode: "NAVFAC" } });
    expect(first.$id).toBeUndefined();
    expect((first.customer as { customersPos: { $values: { customer: unknown }[] } }).customersPos.$values[0].customer).toBeNull();
    expect(() => JSON.stringify(out)).not.toThrow();
  });

  it("leaves an unresolvable reference and plain data as they are", () => {
    expect(resolveRefs({ a: { $ref: "99" }, b: [1, null] })).toEqual({ a: { $ref: "99" }, b: [1, null] });
  });
});

describe("normalizeEvent customer from the PO", () => {
  it("takes the customer from the event's PO when the event names none", () => {
    const e = normalizeEvent({ ...raw, customer: null, customersPo: { cpoId: 1, customer: { customerId: 37, customerCode: "DOE", customerName: "Dept of Energy" } } } as never);
    expect(e).toMatchObject({ customer_code: "DOE", customer_name: "Dept of Energy" });
  });
});

describe("gemsAdapter.fetchEvent", () => {
  afterEach(() => vi.unstubAllGlobals());
  const config = { api_base: "https://gems.test" } as GemsConfig;

  it("reads one event by id and maps a delivered class to completed", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (urls.push(url), Response.json(raw))));
    const event = await gemsAdapter.fetchEvent(config, "2548", "2027-01-01");
    expect(urls).toEqual(["https://gems.test/api/TrainingEvent/2548"]);
    expect(event).toMatchObject({ external_id: "2548", status: "completed" });
  });

  it("is null when GEMS no longer has the event, and throws on other failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("gone", { status: 404, statusText: "Not Found" })));
    expect(await gemsAdapter.fetchEvent(config, "9")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500, statusText: "Server Error" })));
    await expect(gemsAdapter.fetchEvent(config, "9")).rejects.toThrow(/500/);
  });
});

describe("buildInstructorMap", () => {
  it("maps a GEMS instructor to the LMS user mirrored from their portal profile", () => {
    const map = buildInstructorMap(
      [
        { gems_instructor_id: 7, profile_id: "p-jane" },
        { gems_instructor_id: 8, profile_id: "p-sam" },
      ],
      [{ id: "u-jane", external_id: "p-jane" }]
    );
    expect(map.get(7)).toBe("u-jane");
    // Sam's profile hasn't reached the LMS yet: no entry, so the sync falls back to email.
    expect(map.has(8)).toBe(false);
  });
});
