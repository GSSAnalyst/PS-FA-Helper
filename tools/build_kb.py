#!/usr/bin/env python3
"""Builds the offline PeopleBook index the extension searches (kb/*.json).

The Financial Aid PeopleBook PDF is ~1,800 pages, too large to send to Claude
whole, so we extract it page by page and the extension searches it locally.

Usage (needs: pip install pypdf):
    python3 tools/build_kb.py                       # builds every book in BOOKS
    python3 tools/build_kb.py --pdf local.pdf --id peoplebook-fa   # use an already-downloaded PDF

To add another PeopleBook (e.g. Student Financials), add an entry to BOOKS,
run this script, and add the new file to KB_FILES in kb.js.
"""
import argparse, json, os, re, sys, urllib.request

BOOKS = [
    {
        "id": "peoplebook-fa",
        "title": "PeopleSoft Campus Solutions 9.2: Financial Aid (PeopleBook, April 2022)",
        "short": "FA PeopleBook",
        "url": "https://docs.oracle.com/cd/F54774_01/psft/pdf/cs92lsfa-b042022.pdf",
    },
]

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "kb")

FOOTER = re.compile(r"^.*Copyright ©.*Oracle and/or its affiliates\.?\s*\d*\s*$", re.M)
DOT_LEADER = re.compile(r"\.{5,}")


def outline_entries(reader):
    """Flattens the PDF bookmarks into [(page_index, depth, title)]."""
    entries = []

    def walk(items, depth):
        for item in items:
            if isinstance(item, list):
                walk(item, depth + 1)
                continue
            try:
                entries.append((reader.get_destination_page_number(item), depth, item.title.strip()))
            except Exception:
                pass

    walk(reader.outline, 0)
    entries.sort(key=lambda e: e[0])
    return entries


def breadcrumbs(entries, page_count):
    """For each page, the chain of headings (chapter > section > ...) in effect on it."""
    crumbs, stack, i = [], [], 0
    for page in range(page_count):
        while i < len(entries) and entries[i][0] <= page:
            _, depth, title = entries[i]
            stack = stack[:depth] + [title]
            i += 1
        crumbs.append(" > ".join(stack))
    return crumbs


def clean(text):
    text = FOOTER.sub("", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def build(book, pdf_path):
    from pypdf import PdfReader
    reader = PdfReader(pdf_path)
    n = len(reader.pages)
    crumbs = breadcrumbs(outline_entries(reader), n)

    pages = []
    for idx in range(n):
        crumb = crumbs[idx]
        # Skip cover, legal notices, table of contents and index pages: they only add noise.
        if not crumb or crumb.startswith(("Legal Notices", "Contents", "Index")):
            continue
        text = clean(reader.pages[idx].extract_text() or "")
        if len(text) < 80 or len(DOT_LEADER.findall(text)) > 5:
            continue
        pages.append([idx + 1, crumb, text])
        if (idx + 1) % 200 == 0:
            print(f"  {book['id']}: page {idx + 1}/{n}", file=sys.stderr)

    out = {k: book[k] for k in ("id", "title", "short", "url")}
    out["pageCount"] = n
    out["pages"] = pages  # [pdf page number, "Chapter > Section", text]
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f"{book['id']}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {path}: {len(pages)} pages indexed of {n} ({os.path.getsize(path) / 1e6:.1f} MB)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", help="use this local PDF instead of downloading")
    ap.add_argument("--id", help="only build the book with this id")
    args = ap.parse_args()

    books = [b for b in BOOKS if not args.id or b["id"] == args.id]
    if not books:
        sys.exit(f"No book with id {args.id!r} in BOOKS")
    for book in books:
        pdf = args.pdf
        if not pdf:
            pdf = os.path.join(OUT_DIR, f"{book['id']}.pdf")
            print(f"Downloading {book['url']} ...", file=sys.stderr)
            urllib.request.urlretrieve(book["url"], pdf)
        try:
            build(book, pdf)
        finally:
            if not args.pdf and os.path.exists(pdf):
                os.remove(pdf)


if __name__ == "__main__":
    main()
