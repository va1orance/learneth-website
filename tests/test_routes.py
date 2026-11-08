from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
class Routes(unittest.TestCase):
    def test_embedded_preview_and_live_route(self):
        info = (ROOT/'index.html').read_text()
        for marker in ('href="demo/"', 'id="approach"', 'id="setup"', 'id="sample-form"', 'src="assets/site.js"'):
            self.assertIn(marker, info)
        demo = (ROOT/'demo/index.html').read_text()
        for marker in ('id="onboarding"', 'id="api-key"', 'id="consent"', 'src="../assets/live.js"', 'Content-Security-Policy', "form-action 'none'", 'no-referrer'):
            self.assertIn(marker, demo)
        self.assertNotIn('id="sample-form"', demo)
        self.assertFalse((ROOT/'CNAME').exists())
    def test_no_persistence_or_unsafe_html(self):
        code=(ROOT/'assets/live.js').read_text()
        for forbidden in ('localStorage', 'sessionStorage', 'indexedDB', 'innerHTML', 'sendBeacon', 'console.', 'document.cookie'):
            self.assertNotIn(forbidden, code)
        self.assertIn("redirect: 'error'", code)
        self.assertIn("credentials: 'omit'", code)
        self.assertIn("data_collection: 'deny'", code)
if __name__ == '__main__': unittest.main()
