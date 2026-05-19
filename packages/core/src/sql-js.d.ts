declare module "sql.js" {
  export type SqlValue = string | number | Uint8Array | null;

  export interface QueryResults {
    readonly columns: readonly string[];
    readonly values: readonly SqlValue[][];
  }

  export interface Database {
    exec(sql: string): QueryResults[];
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsStatic {
    readonly Database: {
      new (data?: Uint8Array): Database;
    };
  }

  export interface SqlJsConfig {
    readonly locateFile?: (file: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}

type SqlJsQueryResult = import("sql.js").QueryResults;
