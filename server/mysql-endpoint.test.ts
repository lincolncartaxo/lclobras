import { describe, expect, it } from "vitest";
import {
  assertDistinctMysqlEndpoints,
  mysqlEndpointIdentity,
} from "../scripts/mysql-endpoint";

describe("external MySQL endpoint guard", () => {
  it("normalizes host casing and the default port", () => {
    expect(mysqlEndpointIdentity("mysql://SOURCE.test/appdb", "Source")).toBe(
      "source.test:3306/appdb"
    );
  });

  it("rejects a target matching the source even when the port is explicit", () => {
    expect(() =>
      assertDistinctMysqlEndpoints(
        "mysql://source.test/appdb",
        "mysql://SOURCE.TEST:3306/APPDB"
      )
    ).toThrow(/same MySQL host and database/);
  });

  it("allows a distinct destination", () => {
    expect(() =>
      assertDistinctMysqlEndpoints(
        "mysql://manus-source.test/appdb",
        "mysql://hostgator-target.test/appdb"
      )
    ).not.toThrow();
  });

  it("fails closed for invalid or non-MySQL DSNs", () => {
    expect(() => mysqlEndpointIdentity("not-a-url", "Source")).toThrow(
      /valid MySQL URL/
    );
    expect(() =>
      mysqlEndpointIdentity("postgres://source.test/appdb", "Source")
    ).toThrow(/mysql:\/\//);
  });
});
