import fs from "fs";
const args = process.argv.slice(2);
let folder = args[0] || "./";
if (!folder.endsWith("/")) {
  folder += "/";
}
const content = fs.readFileSync(`${folder}index.html`, "utf-8");
fs.writeFileSync(
  `${folder}index.html`,
  content.replace(`src="/assets/index`, `src="./assets/index`)
);
