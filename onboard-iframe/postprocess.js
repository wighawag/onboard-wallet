import fs from "fs";
import { outDir } from "./config.js";
let content = fs.readFileSync(`${outDir}index.html`, "utf-8");
content = content.replace(`src="/assets/index`, `src="./assets/index`);
content = content.replace(`href="/assets/index`, `href="./assets/index`);

fs.writeFileSync(`${outDir}index.html`, content);
