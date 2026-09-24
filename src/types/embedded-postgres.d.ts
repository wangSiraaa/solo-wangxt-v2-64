declare module 'embedded-postgres' {
  // 该包为纯 ESM 且仅在 node16/nodenext 解析下自带类型；
  // 演示工程以 CJS 运行（Node 20 支持 require(ESM)），这里补充最小声明。
  interface EmbeddedPostgresOptions {
    databaseDir: string;
    user?: string;
    password?: string;
    port?: number;
    persistent?: boolean;
    initdbFlags?: string[];
  }
  class EmbeddedPostgres {
    constructor(options: EmbeddedPostgresOptions);
    initialise(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    createDatabase(name: string): Promise<void>;
    dropDatabase(name: string): Promise<void>;
    databaseExists(name: string): Promise<boolean>;
  }
  export default EmbeddedPostgres;
}
