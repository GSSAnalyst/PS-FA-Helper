# Publishing to the Chrome Web Store

Everything you need to submit FA Helper, in order. Answers to the store's forms are below, ready
to paste.

## 1. One-time setup
1. Go to https://chrome.google.com/webstore/devconsole and sign in with the Google account that
   will own the listing. Consider a dedicated account (e.g. a new Gmail for the product), since
   the listing can't easily move between accounts later.
2. Pay the one-time **$5 registration fee**.
3. Under **Account**, set the publisher name and contact email and verify the email.
4. Make the privacy policy reachable at a public URL. The simplest option: make this GitHub repo
   public and use
   `https://github.com/GSSAnalyst/PS-FA-Helper/blob/main/PRIVACY.md`.
   If the repo must stay private, paste PRIVACY.md into a public Google Doc or a GitHub Gist and
   use that link instead. Update the link in `sidepanel.html` to match.

## 2. Build the upload
    ./tools/package.sh          # -> dist/fa-helper-<version>.zip

Before every new upload, bump `version` in manifest.json (e.g. 1.0.0 -> 1.0.1). The store
rejects a version it has already seen.

Test the zip first: unzip it into a temp folder, then load that folder on chrome://extensions
with **Load unpacked**, and try a question, a screenshot and the right-click menu.

## 3. Create the item
Dev console > **New item** > upload the zip. Then fill in these tabs.

### Store listing
- **Name:** PeopleSoft FA Helper
- **Summary (≤132 chars):** Explain PeopleSoft Financial Aid errors, screens and setup, with answers sourced from PeopleBooks, FSA, COD and eCFR.
- **Category:** Workflow & Planning (or Tools)
- **Language:** English
- **Description:**

  > FA Helper is a side-panel assistant for university financial aid offices that run PeopleSoft Campus Solutions.
  >
  > Paste an error message, drop in a screenshot, or ask a Pell, Direct Loan, COD or setup question. FA Helper answers in plain steps and links every answer to its sources:
  >
  > • The full PeopleSoft Campus Solutions 9.2 Financial Aid PeopleBook, searched on your computer, with links to the exact page
  > • FSA Partner Connect: COD Technical Reference, ISIR Guide, FSA Handbook, Electronic Announcements and Dear Colleague Letters
  > • StudentAid.gov, eCFR (34 CFR 668, 685, 690) and the Federal Register
  >
  > Built for privacy:
  > • Social Security and student ID numbers in your text are masked before anything is sent
  > • No accounts, no tracking, no analytics. Settings stay in your browser
  > • Uses your own Claude API key from Anthropic, so you control cost and data terms
  >
  > Also handy: highlight an error on any page, right-click, and choose "Ask FA Helper about this". Add your office's own notes (custom processes, known issues) so answers fit your setup.
  >
  > Requires a Claude API key from console.anthropic.com. FA Helper is an independent tool and is not affiliated with or endorsed by Oracle, the U.S. Department of Education or Anthropic.

- **Icon:** `icons/icon-128.png`
- **Screenshots (required, at least 1, 1280×800 or 640×400 PNG/JPEG):** take 3–5 of the side panel
  open next to a PeopleSoft-like page. Suggested shots: the empty state with starter buttons, an
  error explained with source chips, a screenshot question, and Settings. **Use made-up data:
  no real student information.**
- **Small promo tile (440×280):** optional, but it helps listings look complete.

### Privacy practices
- **Single purpose:** Helps financial aid staff understand PeopleSoft Financial Aid errors, screens and processes by answering questions with cited documentation.
- **Permission justifications:**
  - `sidePanel`: The extension's entire interface is a side panel opened from the toolbar icon.
  - `storage`: Saves the user's API key, model choice, ID-masking preference and office notes locally, and passes highlighted text from the right-click menu to the panel.
  - `contextMenus`: Adds "Ask FA Helper about this" to the right-click menu for highlighted text, so users can send an error message to the panel.
  - Host permission `https://api.anthropic.com/*`: Sends the user's question to the Claude API (Anthropic), using the user's own API key, to generate the answer.
- **Remote code:** No, I am not using remote code. (All JavaScript is in the package.)
- **Data usage, check:**
  - *Authentication information*: the user's API key (stored locally, sent only to Anthropic).
  - *Website content*: text the user highlights and chooses to send, and screenshots the user attaches.
- **Certify all three:** not sold to third parties; not used for unrelated purposes; not used for
  creditworthiness/lending.
- **Privacy policy URL:** the link from step 1.4.

### Distribution
- **Payments:** Free.
- **Visibility:**
  - **Unlisted** for the team rollout. Anyone with the link can install it, but it doesn't show up in search. Start here.
  - **Public** once it's ready for other schools.
  - For a later rollout managed by your university, Google Workspace admins can force-install
    unlisted items for everyone in the org.
- **Regions:** United States.

## 4. Submit
Click **Submit for review**. First reviews usually take a few days, sometimes longer for new
developer accounts. If it's rejected, the email names the policy; the most common causes are a
missing permission justification or a privacy policy URL that doesn't load.

## 5. Updating
Change code > bump manifest version > `./tools/package.sh` > dev console > **Package** > upload new
package > submit. Users update automatically within a few hours of approval.
