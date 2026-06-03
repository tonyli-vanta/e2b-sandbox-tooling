# E2B Sandbox Toolset — Audit One-Pager

*Author: Tony Li (AI Platform), Date: Jun 3, 2026*

## Overview

The Vanta Agent runs LLM-generated code inside an **E2B sandbox** built from the stock runCode template (code-interpreter-v1) with no Vanta customization. The network is disabled in production, so the only file-extraction capability is whatever is pre-installed in the image. This one-pager summarizes what's installed and how to test each file type.

## Reproduce this audit (scripts + fixtures)

All tooling and the test fixtures are in the repo [tonyli-vanta/e2b-sandbox-tooling](https://github.com/tonyli-vanta/e2b-sandbox-tooling) — clone and run end-to-end in Ona terminal:

```bash
git clone https://github.com/tonyli-vanta/e2b-sandbox-tooling
cd e2b-sandbox-tooling
npm install

echo "$E2B_API_KEY"          # expect: empty
export E2B_API_KEY="<your e2b key>"   # e2b.dev → Dashboard → API Keys

# 1. Audit the sandbox toolset (pip list / dpkg / extraction tools)
node e2b-probe.cjs                 # writes /tmp/e2b-probe-out/

# 2. (Re)generate the test fixtures
uv venv .venv && uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/python gen_fixtures.py   # writes /tmp/e2b-fixtures/

# 3. Run every capability-matrix command against the fixtures
node e2b-run-fixtures.cjs
```

All above steps will directly output the results for following sections.

## Spin up a sandbox (interactive)

If you want to run individual commands inside a E2B box terminal (like pip or test files using available tools), following these steps:

(Full hands-on guide: [How to Test the E2B Sandbox (Interactive CLI)](https://app.getguru.com/card/iyEnMApT/How-to-Test-the-E2B-Sandbox-Interactive-CLI)).

In short, from a Ona machine terminal:

```bash
npm i -g @e2b/cli
e2b auth login  # click the link to authorize
e2b sandbox create runCode-dev  # opens an interactive shell; run commands; exit auto-kills it
e2b sandbox list  # copy the sandbox id (also printed by `create`)
# in a SECOND terminal (keep the sandbox session open):
node upload.cjs <sandboxId>  # push fixtures/ -> /home/user/fixtures
# back in the sandbox shell:
cd ~/fixtures  # now the matrix commands work
# Run commands under "How to test (run in fixtures/)" below
```

## Environment

- **OS:** Debian GNU/Linux 13 (trixie) 13.4
- **Python:** 3.13.13 · **Node:** v20.20.2 · **dpkg packages:** 654

## What's installed

One caveat is tools being installed here doesn't guarantee that Vanta Agent would use it everytime or anytime. It is also dependent on how we prompt the agent to select a tool. This work will be covered in [AIPLAT-511](https://vanta.atlassian.net/browse/AIPLAT-511).

| Component | Installed | Covers |
|---|---|---|
| strings, pdftotext + poppler-utils 25.03 (pdfimages, pdftoppm), imagemagick, unzip | ✅ | CLI extraction tools |
| pandas 2.2.3, openpyxl 3.1.5, xlrd 2.0.2 | ✅ | CSV / XLSX / legacy XLS |
| pypdf 6.12.2 / PyPDF2 3.0.1 | ✅ | PDF text |
| python-docx 1.1.2 | ✅ | Word .docx |
| Pillow 12.2, opencv, scikit-image | ✅ | images (open/convert; no OCR) |
| beautifulsoup4 / lxml | ✅ | HTML / XML |
| scipy, scikit-learn, spaCy, nltk, matplotlib, Jupyter | ✅ | bonus data-science / NLP stack |
| tesseract, pytesseract, pdf2image | ❌ | OCR — scanned PDFs & image text |
| pdfplumber, pymupdf, camelot | ❌ | advanced PDF tables |
| python-pptx | ❌ | PowerPoint .pptx |
| antiword / catdoc | ❌ | legacy .doc text |
| libreoffice, ghostscript | ❌ | Office→PDF / PostScript |

## Capability matrix

Every row was validated by `e2b-run-fixtures.cjs` against the checked-in [fixtures](https://github.com/tonyli-vanta/e2b-sandbox-tooling/tree/master/fixtures). The commands below are directly executable from inside the `fixtures/` directory (filenames match the checked-in fixtures).

| File type | Support today | Tool / Lib | How to test (run in fixtures/) |
|---|---|---|---|
| CSV | ✅ Good | pandas | `python3 -c "import pandas as pd; print(pd.read_csv('sample.csv'))"` |
| XLSX | ✅ Good | pandas + openpyxl | `python3 -c "import pandas as pd; print(pd.read_excel('sample.xlsx'))"` |
| Legacy XLS | ✅ Good | pandas + xlrd | `python3 -c "import pandas as pd; print(pd.read_excel('sample_legacy.xls'))"` |
| Text PDF | ✅ Good | pdftotext (preferred) / pypdf | `pdftotext text.pdf -` |
| PDF tables | ⚠️ Partial | pypdf (no pdfplumber/camelot) | `python3 -c "import pypdf; print(pypdf.PdfReader('text.pdf').pages[0].extract_text())"` |
| Scanned / image PDF | ❌ Gap | no OCR engine | `pdftotext scanned.pdf -` |
| Images (text in) | ❌ Gap | Pillow/opencv, no OCR | `python3 -c "from PIL import Image; print(Image.open('image_text.png').size)"` |
| Word .docx | ✅ Good | python-docx | `python3 -c "import docx; print(chr(10).join(p.text for p in docx.Document('sample.docx').paragraphs))"` |
| Word legacy .doc | ❌ Gap | none (no antiword/catdoc) | — (no tool, no .doc fixture) |
| PowerPoint .pptx | ❌ Gap | none (no python-pptx) | `python3 -c "import pptx"` |
| HTML / XML | ✅ Good | beautifulsoup4 + lxml | `python3 -c "from bs4 import BeautifulSoup; print(BeautifulSoup(open('sample.html'),'lxml').get_text())"` |

XLSX gotchas (phantom rows + dropped hyperlinks):

```bash
python3 -c "import openpyxl; ws=openpyxl.load_workbook('sample.xlsx').active; print('max_row', ws.max_row, '| C2 link', ws['C2'].hyperlink.target)"
```

## Gaps & Next Steps

All must be baked into a custom template — runtime install is impossible (network off):

- **OCR (highest value):** `apt: tesseract-ocr` + `pip: pytesseract, pdf2image`. Poppler + Pillow + opencv already present to feed it. *Decision:* if managed Textract handles scanned PDFs acceptably, route there instead (avoids image-size cost).
- **PDF tables:** `pip: pdfplumber` (or pymupdf).
- **PowerPoint:** `pip: python-pptx` (only if .pptx in scope).
- **Legacy .doc:** `apt: antiword` (only if legacy Word in scope).
