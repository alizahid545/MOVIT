import { afterEach, describe, expect, it, vi } from "vitest";
import { checkSupabaseConnectivity } from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkSupabaseConnectivity", () => {
  it("uses a read-only health request and does not expose response content", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("healthy", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkSupabaseConnectivity(
      "https://project.example.supabase.co/",
      "sb_publishable_test-key",
    )).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestOptions] = fetchMock.mock.calls[0]!;
    expect(String(requestUrl)).toBe("https://project.example.supabase.co/auth/v1/health");
    expect(requestOptions?.method).toBe("GET");
    expect(requestOptions?.headers).toEqual({ apikey: "sb_publishable_test-key" });
  });

  it("rejects missing configuration without making a request", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkSupabaseConnectivity(undefined, undefined))
      .rejects.toThrow("Supabase is not configured.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects non-HTTPS remote project URLs", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkSupabaseConnectivity("http://project.example", "public-key"))
      .rejects.toThrow("must be an HTTPS project URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports HTTP failure status without exposing the key or response body", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("sensitive server detail", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const key = "sb_publishable_do-not-include-in-errors";
    let message = "";
    try {
      await checkSupabaseConnectivity("https://project.example", key);
    } catch (caught) {
      message = caught instanceof Error ? caught.message : "";
    }

    expect(message).toContain("HTTP 503");
    expect(message).not.toContain(key);
    expect(message).not.toContain("sensitive server detail");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports network failures without exposing request credentials", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error("network error"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkSupabaseConnectivity("https://project.example", "public-key"))
      .rejects.toThrow("Could not reach the configured Supabase project.");
  });
});
