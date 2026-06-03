/* Live E2B sandbox capability probe for AIPLAT-510.
 * Spins up the runCode template (mirrors prod: network disabled), captures
 * the full package inventory + file-extraction tool probes, then kills it.
 */
const fs = require("node:fs");
const { Sandbox } = require("@e2b/code-interpreter");

const API_KEY = process.env.E2B_API_KEY;
const OUT = "/tmp/e2b-probe-out";
fs.mkdirSync(OUT, { recursive: true });

// Try the runCode aliases in order; fall back to E2B's public base (identical
// contents, since runCode = fromTemplate("code-interpreter-v1") with nothing added).
const TEMPLATE_CANDIDATES = ["runCode-dev", "runCode-staging", "runCode-prod", "code-interpreter-v1"];

const PROBES = [
  ["os-release", "cat /etc/os-release"],
  ["python-version", "python3 --version"],
  ["pip-list", "pip list 2>/dev/null || pip3 list"],
  ["dpkg-l", "dpkg -l"],
  ["which-extract-tools", "for t in strings pdftotext pdfimages pdftoppm tesseract libreoffice soffice unzip file antiword catdoc; do printf '%-12s ' \"$t\"; (command -v $t || echo MISSING); done"],
  ["py-extract-libs", "python3 - <<'PY'\nmods = ['pandas','openpyxl','numpy','xlrd','pdfplumber','fitz','pypdf','PyPDF2','pdfminer','pytesseract','pdf2image','docx','pptx','tabula','camelot','bs4','lxml','PIL']\nimport importlib.metadata as md\nfor m in mods:\n    try:\n        mod = __import__(m)\n        v = getattr(mod,'__version__', None)\n        print(f'{m:14s} OK   {v or \"\"}')\n    except Exception as e:\n        print(f'{m:14s} MISSING')\nPY"],
  ["node-version", "node --version 2>/dev/null || echo 'no node'"],
];

async function main() {
  let sandbox = null;
  let usedTemplate = null;
  let lastErr = null;
  for (const tmpl of TEMPLATE_CANDIDATES) {
    try {
      console.log(`Trying template: ${tmpl} ...`);
      sandbox = await Sandbox.create(tmpl, {
        apiKey: API_KEY,
        timeoutMs: 120_000,
        allowInternetAccess: false, // mirror prod
      });
      usedTemplate = tmpl;
      console.log(`  -> created sandbox ${sandbox.sandboxId} from "${tmpl}"`);
      break;
    } catch (e) {
      lastErr = e;
      console.log(`  -> failed: ${e?.message || e}`);
    }
  }
  if (!sandbox) {
    console.error("Could not create a sandbox from any candidate template.");
    console.error(lastErr);
    process.exit(1);
  }

  fs.writeFileSync(`${OUT}/_meta.txt`, `template=${usedTemplate}\nsandboxId=${sandbox.sandboxId}\nsdk=@e2b/code-interpreter@2.3.3\n`);

  for (const [name, cmd] of PROBES) {
    try {
      const r = await sandbox.commands.run(cmd, { timeoutMs: 60_000 });
      const body = `# ${name}\n$ ${cmd}\n\n--- stdout ---\n${r.stdout}\n--- stderr ---\n${r.stderr}\n(exit ${r.exitCode})\n`;
      fs.writeFileSync(`${OUT}/${name}.txt`, body);
      console.log(`captured ${name} (exit ${r.exitCode}, ${r.stdout.length} bytes stdout)`);
    } catch (e) {
      // CommandExitError still carries stdout/stderr
      const so = e?.stdout ?? "";
      const se = e?.stderr ?? e?.message ?? String(e);
      fs.writeFileSync(`${OUT}/${name}.txt`, `# ${name}\n$ ${cmd}\n\n--- stdout ---\n${so}\n--- stderr ---\n${se}\n(threw)\n`);
      console.log(`captured ${name} (threw): ${se.slice(0,120)}`);
    }
  }

  await sandbox.kill();
  console.log(`\nDone. Killed sandbox. Output in ${OUT}/`);
}

main().catch(e => { console.error(e); process.exit(1); });
