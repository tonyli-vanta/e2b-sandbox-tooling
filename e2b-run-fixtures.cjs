/* Upload the generated fixtures into a live runCode sandbox and run each
 * capability-matrix command against them, capturing real output. */
const fs = require("node:fs");
const path = require("node:path");
const { Sandbox } = require("@e2b/code-interpreter");

const FIX = "/tmp/e2b-fixtures";
const REMOTE = "/home/user/fixtures";

const CMDS = [
  ["CSV (pandas)", `python3 -c "import pandas as pd; print(pd.read_csv('${REMOTE}/sample.csv').to_string())"`],
  ["XLSX read (pandas)", `python3 -c "import pandas as pd; print(pd.read_excel('${REMOTE}/sample.xlsx').to_string())"`],
  ["XLSX gotchas (openpyxl: max_row trap + hyperlink)", `python3 -c "import openpyxl; ws=openpyxl.load_workbook('${REMOTE}/sample.xlsx').active; print('max_row=',ws.max_row,'(phantom; data rows=3)'); print('C2 hyperlink=', ws['C2'].hyperlink.target if ws['C2'].hyperlink else None)"`],
  ["Legacy XLS (pandas+xlrd)", `python3 -c "import pandas as pd; print(pd.read_excel('${REMOTE}/sample_legacy.xls').to_string())"`],
  ["Text PDF (pdftotext)", `pdftotext ${REMOTE}/text.pdf - | head`],
  ["PDF tables (pypdf extract_text)", `python3 -c "import pypdf; print(pypdf.PdfReader('${REMOTE}/text.pdf').pages[0].extract_text())"`],
  ["Scanned PDF -> pdftotext (expect EMPTY = OCR gap)", `pdftotext ${REMOTE}/scanned.pdf - ; echo "[pdftotext returned $(pdftotext ${REMOTE}/scanned.pdf - | wc -c) chars]"; command -v tesseract || echo "tesseract: MISSING (no OCR)"`],
  ["Scanned PDF rasterize (pdftoppm works)", `pdftoppm -png -r 50 ${REMOTE}/scanned.pdf /tmp/pg && ls -1 /tmp/pg*.png`],
  ["PNG (Pillow opens; no OCR)", `python3 -c "from PIL import Image; im=Image.open('${REMOTE}/image_text.png'); print('size',im.size,'mode',im.mode)"`],
  ["DOCX (python-docx)", `python3 -c "import docx; d=docx.Document('${REMOTE}/sample.docx'); print(chr(10).join(p.text for p in d.paragraphs))"`],
  ["Legacy DOC (antiword)", `antiword ${REMOTE}/sample.doc | head`],
  ["PPTX (expect ModuleNotFoundError = gap)", `python3 -c "import pptx; print('pptx present')"`],
  ["HTML (bs4+lxml)", `python3 -c "from bs4 import BeautifulSoup; print(BeautifulSoup(open('${REMOTE}/sample.html'),'lxml').get_text(' ',strip=True))"`],
];

async function run(sbx, cmd) {
  try {
    const r = await sbx.commands.run(cmd, { timeoutMs: 60_000 });
    return { ok: r.exitCode === 0, out: r.stdout, err: r.stderr };
  } catch (e) {
    return { ok: false, out: e?.stdout ?? "", err: e?.stderr ?? e?.message ?? String(e) };
  }
}

async function main() {
  const sbx = await Sandbox.create("runCode-dev", { apiKey: process.env.E2B_API_KEY, timeoutMs: 180_000, allowInternetAccess: false });
  console.log("sandbox:", sbx.sandboxId);
  await sbx.commands.run(`mkdir -p ${REMOTE}`);
  for (const f of fs.readdirSync(FIX)) {
    const bytes = fs.readFileSync(path.join(FIX, f));
    await sbx.files.write(`${REMOTE}/${f}`, new Blob([bytes]));
  }
  console.log("uploaded", fs.readdirSync(FIX).length, "fixtures\n");

  for (const [label, cmd] of CMDS) {
    const r = await run(sbx, cmd);
    console.log(`### ${label}  ->  ${r.ok ? "OK" : "FAIL"}`);
    const body = (r.out || "").trim();
    const errt = (r.err || "").trim();
    if (body) console.log(body.split("\n").slice(0, 8).join("\n"));
    if (!r.ok && errt) console.log("stderr:", errt.split("\n").slice(-3).join(" | "));
    console.log("");
  }
  await sbx.kill();
  console.log("killed sandbox.");
}
main().catch(e => { console.error(e); process.exit(1); });
