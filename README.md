# PeopleSoft FA Helper (Chrome extension)

A side-panel assistant for the Financial Aid team. Paste a PeopleSoft error or a screenshot,
or ask a Pell / Direct Loan / COD / setup question. Claude searches:

- **The full Financial Aid PeopleBook** (PeopleSoft Campus Solutions 9.2, ~1,800 pages), bundled
  with the extension and searched offline. Answers link to the exact PDF page.
- **FSA Partner Connect**: COD Technical Reference, ISIR Guide, FSA Handbook, Electronic
  Announcements, Dear Colleague Letters, plus StudentAid.gov, CSAC, eCFR and the Federal Register.

## Team build (shared API key)
To let the team use one key with no setup:
1. Create a key for this tool in the Claude Console (a separate workspace makes usage easy to track),
   and set a **monthly spend limit** on it.
2. Paste the key into `config.js` (`TEAM_API_KEY = "sk-ant-..."`). The file is git-ignored, so the
   key never reaches GitHub. If `config.js` is missing, copy `config.example.js`.
3. Run `./tools/package.sh` and share `dist/fa-helper-<version>.zip` with the team privately
   (Teams/SharePoint/shared drive). Each person unzips it and uses **Load unpacked** (below).

The key is inside the build, so anyone with the zip can read it. Don't post the team build on the
Chrome Web Store or anywhere public. If it leaks, delete the key in the Console and rebuild with a
new one. Leave `TEAM_API_KEY` empty to go back to each person entering their own key.

## Install from the Chrome Web Store
Open the store link your team lead shared, click **Add to Chrome**, then pin the extension and
click its icon. Paste your Claude API key in Settings, click **Test key**, then **Save settings**.

## Install (developer mode)
1. Unzip this folder somewhere permanent.
2. Open chrome://extensions and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `ps-fa-helper` folder.
4. Pin the extension and click its icon. The side panel opens on Settings.
5. Paste your Claude API key (from console.anthropic.com) and click **Save settings**.

Note: web search must be enabled for your organization in the Claude Console.

## Using it
- Type or paste a question and press Enter (Shift+Enter for a new line).
- **Screenshots:** paste one into the box (Mac: Cmd+Ctrl+Shift+4 copies a screenshot; Windows: Win+Shift+S),
  drag it in, or click **+ Screenshot**. Up to 5 per question. Screenshots are sent as they are:
  ID masking only covers typed text, so crop or cover student information first.
- Or highlight an error on any page, right-click, and choose **Ask FA Helper about this**.
- Add your office's own knowledge (custom processes, known issues) under Settings > Office notes.

## Files
- manifest.json   – extension config (Manifest V3)
- background.js   – opens the side panel, adds the right-click menu
- config.js       – team API key (git-ignored; template in config.example.js)
- claude.js       – Claude API call, allowed search domains, reference library, system prompt, ID masking
- kb.js           – offline search over the bundled PeopleBook (the search_peoplebook tool)
- kb/             – the PeopleBook index (built by tools/build_kb.py)
- tools/build_kb.py – rebuilds the index from Oracle's PDF
- tools/make_icons.py – redraws icons/ (no dependencies)
- tools/package.sh – builds the Chrome Web Store zip in dist/
- PRIVACY.md – privacy policy (link it from the store listing)
- docs/PUBLISHING.md – step-by-step store submission, with form answers
- docs/ROADMAP.md – plan for the hosted (Supabase) version and national rollout
- sidepanel.*     – the panel UI
- markdown.js     – safe rendering of answers

To change which sites Claude may search, edit SEARCH_DOMAINS in claude.js. To change the key
documents Claude knows to open (FSA Handbook, COD Technical Reference, CFR parts…), edit REFERENCE_LIBRARY.

## Updating or adding PeopleBooks
The index is built from Oracle's PDF:

    pip install pypdf
    python3 tools/build_kb.py

To add another book (for example Student Financials, `cs92lssf-b042022.pdf`), add it to BOOKS in
tools/build_kb.py, run the script, and add the new `kb/<id>.json` file to KB_FILES in kb.js.

## Releasing a new version
1. Bump `version` in manifest.json.
2. Run `./tools/package.sh`.
3. Upload `dist/fa-helper-<version>.zip` in the Chrome Web Store developer console (see docs/PUBLISHING.md).
