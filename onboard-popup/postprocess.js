import fs from "fs";
import { outDir } from "./config.js";
const content = fs.readFileSync(`${outDir}index.html`, "utf-8");
fs.writeFileSync(
  `${outDir}index.html`,
  content.replace(`src="/assets/index`, `src="./assets/index`)
);
