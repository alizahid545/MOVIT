import { afterEach, describe, expect, it } from "vitest";
import {
  flushDevelopmentWrites,
  persistDevelopmentData,
  readDevelopmentData,
  removeDevelopmentData,
  writeDevelopmentData,
} from "./local-development-repository";

const key = "repository-test-record";

afterEach(async () => {
  await removeDevelopmentData(key);
});

describe("local development repository", () => {
  it("round-trips non-sensitive development data through persistent storage", async () => {
    const record = {
      profile: "sample athlete",
      activeRole: "athlete",
      completedRoles: ["athlete"],
    };
    await writeDevelopmentData(key, record);

    expect(await readDevelopmentData(key, null)).toEqual(record);
  });

  it("flushes queued preview writes before a reload reads them", async () => {
    await writeDevelopmentData(key, { value: 1 });
    const changed = { value: 2 };
    persistDevelopmentData(key, changed);
    await flushDevelopmentWrites();

    expect(await readDevelopmentData(key, null)).toEqual(changed);
  });
});
