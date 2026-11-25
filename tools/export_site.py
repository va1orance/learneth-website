"""Export the public runtime to a new deployment directory."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import shutil
import sys

PUBLIC_ITEMS = ('index.html', 'assets', 'demo', 'LICENSE', 'NOTICE', 'LICENSING.md', '.nojekyll')
REQUIRED_CSP = {
    'default-src': ("'none'",),
    'script-src': ("'self'",),
    'style-src': ("'self'",),
    'object-src': ("'none'",),
    'frame-src': ("'none'",),
    'form-action': ("'none'",),
    'base-uri': ("'none'",),
    'worker-src': ("'none'",),
}
ALLOWED_IMG_SRC = {"'self'", 'blob:'}


class PageInspector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.csp = ''
        self.csp_count = 0
        self.refs = []
        self.connect_urls = []
        self.inline_violations = []
        self._in_script = False

    def handle_starttag(self, tag, attrs):
        ltag = tag.lower()
        attr_map = {k.lower(): v for k, v in attrs}
        if ltag == 'meta' and (attr_map.get('http-equiv') or '').lower() == 'content-security-policy':
            self.csp_count += 1
            self.csp = attr_map.get('content') or ''
        for key in ('src', 'href'):
            if key in attr_map:
                self.refs.append(attr_map[key])
        for attr in ('data-live-example-url', 'data-free-demo-url'):
            if attr in attr_map:
                self.connect_urls.append((attr, (attr_map[attr] or '').strip()))
        for key in attr_map:
            if key == 'style' or key.startswith('on'):
                self.inline_violations.append(f'disallowed attribute {key} on <{ltag}>')
        if ltag == 'style':
            self.inline_violations.append('disallowed inline <style> tag')
        if ltag == 'script':
            self._in_script = True
            if not (attr_map.get('src') or '').strip():
                self.inline_violations.append('disallowed inline <script> without src')

    def handle_endtag(self, tag):
        if tag.lower() == 'script':
            self._in_script = False

    def handle_data(self, data):
        if self._in_script and data.strip():
            self.inline_violations.append('disallowed non-empty <script> body')


def parse_csp(raw):
    directives = {}
    for part in raw.split(';'):
        tokens = part.strip().split()
        if tokens:
            directives[tokens[0].lower()] = tokens[1:]
    return directives


def validate_site(root):
    root = Path(root).resolve()
    for rel in ('index.html', 'demo/index.html'):
        page = root / rel
        if not page.is_file():
            raise ValueError(f'Missing public page: {rel}')
        text = page.read_text(encoding='utf-8')
        inspector = PageInspector()
        inspector.feed(text)

        if 'styles.css' in text:
            raise ValueError(f'{rel} still references legacy styles.css')
        if inspector.inline_violations:
            raise ValueError(f'{rel} violates strict CSP: {inspector.inline_violations[0]}')
        if inspector.csp_count != 1:
            raise ValueError(f'{rel} must declare exactly one Content-Security-Policy meta tag, found {inspector.csp_count}')

        for ref in inspector.refs:
            parts = urlsplit(ref)
            if ref.startswith('//') or (parts.netloc and not parts.scheme):
                raise ValueError(f'{rel} contains protocol-relative ref: {ref}')
            if parts.scheme:
                if parts.scheme != 'https':
                    raise ValueError(f'{rel} contains non-HTTPS external ref: {ref}')
                continue
            target = (page.parent / unquote(parts.path)).resolve() if parts.path else page
            if target.is_dir():
                target = target / 'index.html'
            try:
                rel_target = target.relative_to(root)
            except ValueError as exc:
                raise ValueError(f'{rel} references path outside exported site: {ref}') from exc
            if not rel_target.parts or rel_target.parts[0] not in PUBLIC_ITEMS:
                raise ValueError(f'{rel} references unexported local path: {ref}')
            if rel_target.as_posix() == 'assets/styles.css':
                raise ValueError(f'{rel} references excluded assets/styles.css')
            if not target.is_file():
                raise ValueError(f'{rel} references missing local path: {ref}')

        directives = parse_csp(inspector.csp)
        for directive, expected in REQUIRED_CSP.items():
            actual = tuple(directives.get(directive, ()))
            if actual != expected:
                raise ValueError(f'{rel} CSP directive {directive} must be {" ".join(expected)}, got {" ".join(actual)}')

        img_src = directives.get('img-src', [])
        if "'self'" not in img_src or not set(img_src).issubset(ALLOWED_IMG_SRC):
            raise ValueError(f'{rel} CSP directive img-src invalid: {img_src}')

        connect_src = directives.get('connect-src', [])
        if not connect_src:
            raise ValueError(f'{rel} CSP missing connect-src')
        for attr, url_val in inspector.connect_urls:
            if not url_val:
                continue
            parts = urlsplit(url_val)
            if parts.scheme != 'https' or not parts.netloc:
                raise ValueError(f'{rel} {attr} must be an HTTPS URL: {url_val}')
            origin = f'{parts.scheme}://{parts.netloc}'
            if 'https:' not in connect_src and origin not in connect_src:
                raise ValueError(f'{rel} {attr} origin {origin} is not permitted by CSP connect-src: {connect_src}')


def export(destination):
    root = Path(__file__).resolve().parents[1]
    destination = Path(destination)
    if destination.exists():
        raise SystemExit('Destination already exists; review and choose a new staging directory.')
    try:
        validate_site(root)
    except ValueError as exc:
        raise SystemExit(f'Export preflight failed: {exc}') from exc

    destination.mkdir(parents=True)
    for name in PUBLIC_ITEMS:
        source = root / name
        if source.is_dir():
            ignore = shutil.ignore_patterns('styles.css') if name == 'assets' else None
            shutil.copytree(source, destination / name, ignore=ignore)
        else:
            shutil.copy2(source, destination / name)
    print('Exported public runtime to ' + str(destination))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python3 tools/export_site.py NEW_DESTINATION')
    export(sys.argv[1])
