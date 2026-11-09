import { describe, expect, it } from "vitest";
import { readAttributionParams, stripParams } from "./attribution";

describe("Portal attribution URL handling", () => {
  it("collects custom keys and identifies only associated signatures", () => {
    const { params, signatureKeys } = readAttributionParams(
      "?custom_id=pro&custom_id_sig=x&custom_id_ts=123&sort=top&unrelated_sig=x",
    );
    expect(params.custom_id).toBe("pro");
    expect(signatureKeys).toEqual(["custom_id_sig", "custom_id_ts"]);
  });
  it("bounds input and uses own properties for prototype-like names", () => {
    const query = new URLSearchParams({
      constructor: "pro",
      long: "x".repeat(257),
      ["x".repeat(105)]: "value",
      ["k".repeat(104)]: "kept",
    });
    const { params } = readAttributionParams(query.toString());
    expect(params.constructor).toBe("pro");
    expect(Object.keys(params)).toEqual(["constructor", "k".repeat(104)]);
    expect(
      Object.keys(
        readAttributionParams(
          Array.from({ length: 51 }, (_, i) => `p${i}=x`).join("&"),
        ).params,
      ),
    ).toHaveLength(50);
  });
  it("removes only requested keys and preserves current unrelated query and hash", () => {
    expect(
      stripParams(
        {
          pathname: "/portal",
          search: "?custom=pro&sort=new",
          hash: "#comments",
        },
        ["custom"],
      ),
    ).toBe("/portal?sort=new#comments");
    expect(stripParams({ pathname: "/portal", search: "", hash: "" }, [])).toBe(
      "/portal",
    );
  });
});
