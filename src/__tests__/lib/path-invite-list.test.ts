import { describe, it, expect } from "vitest";
import { parseInviteList } from "@/lib/paths/invite-list";

describe("parseInviteList", () => {
  it("reads addresses with and without names, de-duplicated and lower-cased", () => {
    const { invitees, invalid } = parseInviteList(
      "jane@example.com\nBob Smith <Bob@Example.com>, Ann Lee ann@example.com; JANE@example.com\nCarla Diaz, carla@example.com\nnot an address"
    );
    expect(invitees).toEqual([
      { email: "jane@example.com", firstName: "", lastName: "" },
      { email: "bob@example.com", firstName: "Bob", lastName: "Smith" },
      { email: "ann@example.com", firstName: "Ann", lastName: "Lee" },
      { email: "carla@example.com", firstName: "Carla", lastName: "Diaz" },
    ]);
    expect(invalid).toEqual(["not an address"]);
  });
});
