# E2B Sandbox Tooling

Throwaway-but-reusable tools for auditing and testing Vanta's E2B **`runCode`** sandbox
(the code-execution environment the Vanta Agent uses to extract/process files).

Built for the **AIPLAT-508** epic ("Improve sandbox toolset for Agent use cases").
Not part of the `obsidian` monorepo — standalone so it runs from a clean clone.

Related:
- Epic: AIPLAT-508 · Spike/results: AIPLAT-510 · Template build: AIPLAT-512 · Eval: AIPLAT-509
- Interactive how-to (Guru): **How to Test the E2B Sandbox (Interactive CLI)** — https://app.getguru.com/card/iyEnMApT/How-to-Test-the-E2B-Sandbox-Interactive-CLI

## What's here

| File | Purpose |
|---|---|
| `e2b-probe.cjs` | Spin up a live `runCode` sandbox, capture `pip list` / `dpkg -l` / extraction-tool inventory → `/tmp/e2b-probe-out/`. |
| `gen_fixtures.py` | Generate deterministic test fixtures (csv, html, xlsx w/ hyperlink + phantom-row trap, legacy xls, text pdf, image-only "scanned" pdf, png, docx, pptx) → `/tmp/e2b-fixtures/`. |
| `e2b-run-fixtures.cjs` | Upload the fixtures into a live sandbox and run each capability-matrix command, printing real output. |
| `upload.cjs` | Push the checked-in `fixtures/` into an **already-running** sandbox (via `Sandbox.connect`) so you can run the matrix commands by hand in an interactive `e2b sandbox create` session. |

## Prerequisites

- **Node 20+** and **`E2B_API_KEY`** in your environment (a dev key reaches `runCode-dev`).
- `npm install` (pulls `@e2b/code-interpreter` — no monorepo / `NODE_PATH` hack needed).

```bash
npm install
export E2B_API_KEY="<your e2b dev key>"
```

## Usage

**1. Audit the sandbox toolset**
```bash
node e2b-probe.cjs
cat /tmp/e2b-probe-out/pip-list.txt /tmp/e2b-probe-out/which-extract-tools.txt
```

**2. Generate fixtures** (needs Python deps in a throwaway venv)
```bash
uv venv .venv && uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/python gen_fixtures.py        # writes /tmp/e2b-fixtures/
```

**3. Run fixtures through the sandbox commands**
```bash
node e2b-run-fixtures.cjs
```

**4. Manually test in an interactive sandbox** — push the checked-in fixtures into a sandbox you're poking at by hand:
```bash
# terminal 1 — open the sandbox and keep this session running:
e2b sandbox create runCode-dev

# terminal 2 — get the sandbox id, then upload the fixtures into that sandbox:
e2b sandbox list                      # copy the running sandbox's id
node upload.cjs <sandboxId>           # writes fixtures/ -> /home/user/fixtures

# back in terminal 1 (the sandbox shell): fixtures are now present
cd ~/fixtures && pdftotext text.pdf -
```

## Notes

- The probe and runner create the sandbox with `allowInternetAccess: false` to mirror production — so anything needing the network (`pip install`, `curl`) will fail inside. Tools must be pre-installed in the template.
- Fixtures and probe output are git-ignored; regenerate them with the scripts (the scripts are the durable artifact, not the binaries).
- Never commit secrets — `E2B_API_KEY` is read from the environment only.
