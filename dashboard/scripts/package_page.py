"""Package the built dashboard (dist/) as one HTML page body for publishing as a shared page.

Usage (from dashboard/, after `npm run build`):
    python scripts/package_page.py <output.html>

The page host wraps the file in its own <html>/<head>/<body>, so the output holds
only a <title>, the font link, the inlined CSS and JS, and the root element. The
test images are published next to it as images/<file> (from public/images/).
Raw U+FFFD characters (model outputs cut mid-character at the token limit) are
written as \\uFFFD escapes inside the script, which decode to the same character.
"""
import re
import sys
from pathlib import Path

DIST = Path(__file__).resolve().parent.parent / "dist"
BACKSLASH = chr(92)


def main():
    out = Path(sys.argv[1])
    html = (DIST / "index.html").read_text(encoding="utf-8")
    css = (DIST / re.search(r'href="\./(assets/[^"]+\.css)"', html).group(1)).read_text(encoding="utf-8")
    js = (DIST / re.search(r'src="\./(assets/[^"]+\.js)"', html).group(1)).read_text(encoding="utf-8")
    assert "</script" not in js.lower() and "</style" not in css.lower()
    js = js.replace(chr(0xFFFD), BACKSLASH + "uFFFD")
    fonts = re.search(r'<link\s+rel="stylesheet"\s+href="([^"]+)"', html).group(1)
    title = re.search(r"<title>(.*?)</title>", html).group(1)
    page = (
        f"<title>{title}</title>\n"
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        f'<link rel="stylesheet" href="{fonts}">\n'
        f"<style>{css}</style>\n"
        '<div id="root"></div>\n'
        f'<script type="module">{js}</script>\n'
    )
    assert chr(0xFFFD) not in page
    out.write_text(page, encoding="utf-8", newline="\n")
    print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
