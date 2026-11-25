from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / 'tools') not in sys.path:
    sys.path.insert(0, str(ROOT / 'tools'))

import export_site


class Export(unittest.TestCase):
    def test_export_runtime_only_and_refuse_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            dest = Path(temp) / 'learneth'
            result = subprocess.run([sys.executable, str(ROOT / 'tools/export_site.py'), str(dest)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue((dest / 'demo/index.html').is_file())
            self.assertTrue((dest / 'LICENSE').is_file())
            for asset in ('typewriter.css', 'live.css', 'live.js', 'render.js', 'site.js'):
                self.assertTrue((dest / 'assets' / asset).is_file(), asset)
            self.assertFalse((dest / 'assets/styles.css').exists())
            self.assertFalse((dest / 'worker').exists())
            self.assertFalse((dest / '.git').exists())
            self.assertFalse((dest / 'tests').exists())
            self.assertFalse((dest / 'CNAME').exists())
            again = subprocess.run([sys.executable, str(ROOT / 'tools/export_site.py'), str(dest)], capture_output=True, text=True)
            self.assertNotEqual(again.returncode, 0)

    def test_validate_site_rejects_styles_css_and_csp_mismatch(self):
        with tempfile.TemporaryDirectory() as temp:
            copy_root = Path(temp) / 'site'
            shutil.copytree(ROOT / 'assets', copy_root / 'assets')
            shutil.copytree(ROOT / 'demo', copy_root / 'demo')
            shutil.copy2(ROOT / 'index.html', copy_root / 'index.html')
            shutil.copy2(ROOT / 'LICENSING.md', copy_root / 'LICENSING.md')
            export_site.validate_site(copy_root)

            bad_demo = copy_root / 'demo/index.html'
            orig_demo = bad_demo.read_text(encoding='utf-8')
            bad_demo.write_text(orig_demo.replace('../assets/live.css', '../assets/styles.css'), encoding='utf-8')
            with self.assertRaises(ValueError):
                export_site.validate_site(copy_root)
            bad_demo.write_text(orig_demo, encoding='utf-8')

            bad_index = copy_root / 'index.html'
            orig_index = bad_index.read_text(encoding='utf-8')
            bad_index.write_text(
                orig_index.replace(
                    'data-live-example-url="https://learneth-example-proxy.va1orance.workers.dev"',
                    'data-live-example-url="https://evil.example/api"',
                ),
                encoding='utf-8',
            )
            with self.assertRaises(ValueError):
                export_site.validate_site(copy_root)

            bad_mutations = [
                orig_index.replace('href="LICENSING.md"', 'href="README.md"'),
                orig_index.replace('href="LICENSING.md"', 'href="//evil.example/a"'),
                orig_index.replace("worker-src 'none'", "worker-src 'self'"),
                orig_index.replace("img-src 'self'", "img-src https:"),
                orig_index.replace('<meta name="referrer"', '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'"><meta name="referrer"'),
                orig_index.replace('</body>', '<script>alert(1)</script></body>'),
                orig_index.replace('</body>', '<style>body{color:red}</style></body>'),
                orig_index.replace('<main id="main">', '<main id="main" style="color:red">'),
                orig_index.replace('<main id="main">', '<main id="main" onclick="x()">'),
            ]
            (copy_root / 'README.md').write_text('readme', encoding='utf-8')
            for mutated in bad_mutations:
                bad_index.write_text(mutated, encoding='utf-8')
                with self.assertRaises(ValueError):
                    export_site.validate_site(copy_root)


if __name__ == '__main__':
    unittest.main()
