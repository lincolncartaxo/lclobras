export class MysqlEndpointError extends Error {}

export function mysqlEndpointIdentity(
  connectionString: string,
  label: string
): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new MysqlEndpointError(`${label} DSN must be a valid MySQL URL.`);
  }
  if (url.protocol !== "mysql:") {
    throw new MysqlEndpointError(`${label} DSN must use the mysql:// scheme.`);
  }
  let database: string;
  try {
    database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  } catch {
    throw new MysqlEndpointError(`${label} DSN has an invalid database path.`);
  }
  if (!url.hostname || !database) {
    throw new MysqlEndpointError(
      `${label} DSN must include a host and database name.`
    );
  }
  return `${url.hostname.toLowerCase()}:${url.port || "3306"}/${database.toLowerCase()}`;
}

export function assertDistinctMysqlEndpoints(
  sourceConnectionString: string,
  targetConnectionString: string
): void {
  if (
    mysqlEndpointIdentity(sourceConnectionString, "Source") ===
    mysqlEndpointIdentity(targetConnectionString, "Target")
  ) {
    throw new MysqlEndpointError(
      "Source and destination resolve to the same MySQL host and database; operation stopped."
    );
  }
}
