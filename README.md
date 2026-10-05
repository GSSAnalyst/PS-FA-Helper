# PeopleSoft FA Helper (Chrome extension)

A side-panel assistant for the Financial Aid team. Paste a PeopleSoft error or a screenshot,
or ask a Pell / Direct Loan / COD / setup question. Claude searches:

- **The full Financial Aid PeopleBook** (PeopleSoft Campus Solutions 9.2, ~1,800 pages), bundled
  with the extension and searched offline. Answers link to the exact PDF page.
- **FSA Partner Connect**: COD Technical Reference, ISIR Guide, FSA Handbook, Electronic
  Announcements, Dear Colleague Letters, plus StudentAid.gov, CSAC, eCFR and the Federal Register.

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
- claude.js       – Claude API call, allowed search domains, reference library, system prompt, ID masking
- kb.js           – offline search over the bundled PeopleBook (the search_peoplebook tool)
- kb/             – the PeopleBook index (built by tools/build_kb.py)
- tools/build_kb.py – rebuilds the index from Oracle's PDF
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
# PS-FA-Helper
