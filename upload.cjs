/* Upload the local fixtures into an ALREADY-RUNNING sandbox, from your terminal.
 *
 *   node upload.cjs <sandboxId>
 *
 * Get <sandboxId> from the `e2b sandbox create` output, or `e2b sandbox list`.
 * Keep that interactive session open (the sandbox dies when it ends), then run
 * this from a second terminal. Files land in /home/user/fixtures inside the
 * sandbox; back in the sandbox shell: `ls ~/fixtures` and run the matrix commands.
 *
 * Use this when the sandbox has no internet (mirrors prod). If it does have
 * internet, you can instead curl the public release zip from inside the sandbox.
 */
const fs = require("node:fs");
const path = require("node:path");
const { Sandbox } = require("@e2b/code-interpreter");

const REMOTE_DIR = "/home/user/fixtures";
const LOCAL_DIR = path.join(__dirname, "fixtures");

async function main() {
  const sandboxId = process.argv[2];
  if (!sandboxId) {
    console.error("usage: node upload.cjs <sandboxId>   (get the id from `e2b sandbox list`)");
    process.exit(1);
  }
  if (!process.env.E2B_API_KEY) {
    console.error("E2B_API_KEY is not set. Run: export E2B_API_KEY=<your e2b key>");
    process.exit(1);
  }

  const sbx = await Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY });
  await sbx.commands.run(`mkdir -p ${REMOTE_DIR}`);

  let n = 0;
  for (const f of fs.readdirSync(LOCAL_DIR)) {
    if (f === "README.md") continue; // ship only the fixtures, not the doc
    await sbx.files.write(`${REMOTE_DIR}/${f}`, new Blob([fs.readFileSync(path.join(LOCAL_DIR, f))]));
    console.log("uploaded", f);
    n++;
  }
  console.log(`\n${n} fixtures -> ${REMOTE_DIR} (sandbox ${sandboxId}). In the sandbox shell: cd ~/fixtures && ls`);
}

main().catch(e => {
  console.error("upload failed:", e?.message || e);
  process.exit(1);
});
