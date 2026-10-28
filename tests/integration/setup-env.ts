import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { testDatabaseUrl } from "./test-env";

process.env.DATABASE_URL = testDatabaseUrl();
process.env.CAREEROS_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "careeros-test-"));
process.env.MAX_UPLOAD_MB = "1";
