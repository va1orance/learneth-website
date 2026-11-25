from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / 'tools') not in sys.path:
    sys.path.insert(0, str(ROOT / 'tools'))

import export_site


class Routes(unittest.TestCase):
    def test_embedded_preview_and_live_route(self):
        info = (ROOT/'index.html').read_text()
        for marker in ('href="demo/"', 'id="approach"', 'id="setup"', 'id="sample-form"', 'src="assets/site.js"'):
            self.assertIn(marker, info)
        self.assertNotIn('styles.css', info)
        demo = (ROOT/'demo/index.html').read_text()
        for marker in ('id="onboarding"', 'id="api-key"', 'id="consent"', 'src="../assets/live.js"', 'Content-Security-Policy', "form-action 'none'", 'no-referrer'):
            self.assertIn(marker, demo)
        self.assertNotIn('styles.css', demo)
        self.assertNotIn('id="sample-form"', demo)
        self.assertFalse((ROOT/'CNAME').exists())

    def test_csp_and_endpoint_origins_sync(self):
        export_site.validate_site(ROOT)
        index_html = (ROOT / 'index.html').read_text()
        demo_html = (ROOT / 'demo/index.html').read_text()
        index_ins = export_site.PageInspector()
        index_ins.feed(index_html)
        demo_ins = export_site.PageInspector()
        demo_ins.feed(demo_html)
        self.assertEqual([a for a, _ in index_ins.connect_urls], ['data-live-example-url'])
        self.assertEqual([a for a, _ in demo_ins.connect_urls], ['data-free-demo-url'])

    def test_no_persistence_or_unsafe_html(self):
        for rel in ('assets/live.js', 'assets/render.js'):
            code = (ROOT / rel).read_text()
            for forbidden in ('localStorage', 'sessionStorage', 'indexedDB', 'innerHTML', 'sendBeacon', 'console.', 'document.cookie'):
                self.assertNotIn(forbidden, code, f'{rel} must not use {forbidden}')
        code = (ROOT / 'assets/live.js').read_text()
        self.assertIn("redirect: 'error'", code)
        self.assertIn("credentials: 'omit'", code)
        self.assertIn("data_collection: 'deny'", code)
        self.assertIn('redact(', code)

    def test_homepage_security_headers_and_visibility_pause(self):
        info = (ROOT/'index.html').read_text()
        for marker in ('Content-Security-Policy', 'no-referrer', 'rel="noopener noreferrer"'):
            self.assertIn(marker, info)
        site_js = (ROOT/'assets/site.js').read_text()
        self.assertNotIn('innerHTML', site_js)
        self.assertIn('visibilitychange', site_js)
if __name__ == '__main__': unittest.main()
