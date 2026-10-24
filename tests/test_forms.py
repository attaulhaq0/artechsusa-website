"""Exercise the real PHP form endpoints and SMTP/TLS boundary, without external mail."""
from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
from email import policy
from email.parser import BytesParser
from http.cookiejar import CookieJar
import json
import os
from pathlib import Path
import shutil
import socket
import socketserver
import ssl
import subprocess
import threading
import time
import unittest
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, build_opener, HTTPCookieProcessor
import uuid

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / 'test-results'
PHP = os.environ.get('PHP_BIN') or shutil.which('php')
PHP_INI = os.environ.get('PHP_INI')
FIXTURE = QA / ('form-fixture-' + uuid.uuid4().hex[:10])
RECIPIENT = 'hr@artechsusa.com'


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def certificate(folder):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'localhost')])
    now = datetime.now(timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
            .public_key(key.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now - timedelta(days=1)).not_valid_after(now + timedelta(days=2))
            .add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost')]), False)
            .add_extension(x509.BasicConstraints(ca=True, path_length=None), True)
            .sign(key, hashes.SHA256()))
    cert_file, key_file = folder / 'localhost-ca.pem', folder / 'localhost-key.pem'
    cert_file.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_file.write_bytes(key.private_bytes(serialization.Encoding.PEM,
                                         serialization.PrivateFormat.PKCS8,
                                         serialization.NoEncryption()))
    return cert_file, key_file


class SMTPHandler(socketserver.StreamRequestHandler):
    def reply(self, message):
        self.wfile.write((message + '\r\n').encode('ascii'))
        self.wfile.flush()

    def handle(self):
        self.reply('220 localhost AR TECH INC QA fixture')
        tls, sender, recipients = False, '', []
        while True:
            raw = self.rfile.readline(20000)
            if not raw:
                return
            command = raw.decode('ascii', 'replace').strip()
            upper = command.upper()
            if upper.startswith(('EHLO ', 'HELO ')):
                self.reply('250-localhost')
                self.reply('250-SIZE 8000000')
                if not tls:
                    self.reply('250-STARTTLS')
                self.reply('250-AUTH LOGIN PLAIN')
                self.reply('250 HELP')
            elif upper == 'STARTTLS':
                self.reply('220 Begin TLS')
                self.rfile.close()
                self.wfile.close()
                self.connection = self.server.tls_context.wrap_socket(self.connection, server_side=True)
                self.rfile = self.connection.makefile('rb')
                self.wfile = self.connection.makefile('wb')
                tls = True
            elif upper.startswith('AUTH LOGIN'):
                self.reply('334 ' + base64.b64encode(b'Username:').decode())
                self.rfile.readline()
                self.reply('334 ' + base64.b64encode(b'Password:').decode())
                self.rfile.readline()
                self.reply('235 Authenticated' if tls else '530 TLS required')
            elif upper.startswith('AUTH PLAIN'):
                if len(command.split()) < 3:
                    self.reply('334 ')
                    self.rfile.readline()
                self.reply('235 Authenticated' if tls else '530 TLS required')
            elif upper.startswith('MAIL FROM:'):
                sender = command.split(':', 1)[1].strip()
                recipients = []
                self.reply('250 Sender accepted')
            elif upper.startswith('RCPT TO:'):
                recipients.append(command.split(':', 1)[1].strip())
                self.reply('250 Recipient accepted')
            elif upper == 'DATA':
                self.reply('354 End with a dot')
                chunks = []
                while True:
                    line = self.rfile.readline(20000)
                    if line in (b'.\r\n', b'.\n', b''):
                        break
                    chunks.append(line[1:] if line.startswith(b'..') else line)
                if self.server.reject_data:
                    self.reply('451 Fixture simulates SMTP rejection')
                else:
                    self.server.messages.append({'sender': sender, 'recipients': recipients,
                                                 'tls': tls, 'data': b''.join(chunks)})
                    self.reply('250 Queued by local QA fixture')
            elif upper == 'QUIT':
                self.reply('221 Goodbye')
                return
            elif upper.startswith(('RSET', 'NOOP')):
                self.reply('250 OK')
            else:
                self.reply('502 Unsupported fixture command')


class SMTPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def pdf_document():
    # Valid, short fixture PDF. This is test data, never an actual person's resume.
    from reportlab.pdfgen.canvas import Canvas
    from io import BytesIO
    stream = BytesIO()
    canvas = Canvas(stream)
    canvas.drawString(72, 720, 'AR TECH INC local form acceptance fixture')
    canvas.save()
    return stream.getvalue()


def multipart(fields, filename=None, data=None, mime='application/pdf'):
    boundary = 'artech-qa-' + uuid.uuid4().hex
    chunks = []
    for key, value in fields.items():
        chunks.extend([f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n'.encode(),
                       str(value).encode('utf-8'), b'\r\n'])
    if filename is not None:
        chunks.extend([f'--{boundary}\r\nContent-Disposition: form-data; name="resume"; filename="{filename}"\r\nContent-Type: {mime}\r\n\r\n'.encode(),
                       data or b'', b'\r\n'])
    chunks.append(f'--{boundary}--\r\n'.encode())
    return b''.join(chunks), 'multipart/form-data; boundary=' + boundary


class FormIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not PHP:
            raise RuntimeError('PHP 8.4 must be on PATH, or set PHP_BIN to its executable.')
        FIXTURE.mkdir(parents=True)
        cert, key = certificate(FIXTURE)
        cls.cert = cert
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(str(cert), str(key))
        cls.smtp = SMTPServer(('127.0.0.1', 0), SMTPHandler)
        cls.smtp.tls_context = context
        cls.smtp.messages = []
        cls.smtp.reject_data = False
        threading.Thread(target=cls.smtp.serve_forever, daemon=True).start()
        cls.port = free_port()
        cls.origin = f'http://127.0.0.1:{cls.port}'
        cls.config = FIXTURE / 'forms-config.php'
        cls.runtime_counter = 0
        cls.write_config()
        import os
        env = os.environ.copy()
        env['ARTECH_CONFIG_FILE'] = str(cls.config)
        cls.log = (FIXTURE / 'php-server.log').open('w', encoding='utf-8')
        php_command = [str(PHP)] + (['-c', PHP_INI] if PHP_INI else [])
        cls.process = subprocess.Popen(php_command + ['-S', f'127.0.0.1:{cls.port}',
                                        '-t', str(ROOT / 'public_html'), str(ROOT / 'scripts/dev-router.php')],
                                       cwd=ROOT, env=env, stdout=cls.log, stderr=cls.log)
        for _ in range(80):
            if cls.process.poll() is not None:
                raise RuntimeError('PHP fixture failed to start')
            try:
                with socket.create_connection(('127.0.0.1', cls.port), timeout=.2):
                    break
            except OSError:
                time.sleep(.05)
        else:
            raise RuntimeError('PHP fixture did not become available')

    @classmethod
    def write_config(cls, **overrides):
        cls.runtime_counter += 1
        values = {'enabled': True, 'site_origin': cls.origin,
                  'runtime_dir': str(FIXTURE / f'state-{cls.runtime_counter}'),
                  'rate_secret': 'local-fixture-only-' + '4' * 48,
                  'submit_limit': 50, 'token_limit': 100,
                  'smtp_host': 'localhost', 'smtp_port': cls.smtp.server_address[1],
                  'smtp_security': 'tls', 'smtp_username': RECIPIENT,
                  'smtp_password': 'local-fixture-only-password', 'from_email': RECIPIENT,
                  'ca_file': str(cls.cert)}
        values.update(overrides)
        def php_value(value):
            if isinstance(value, bool):
                return 'true' if value else 'false'
            if isinstance(value, int):
                return str(value)
            return "'" + value.replace('\\', '\\\\').replace("'", "\\'") + "'"
        text = '<?php\nreturn [\n' + ''.join(f"    '{key}' => {php_value(value)},\n" for key, value in values.items()) + '];\n'
        cls.config.write_text(text, encoding='utf-8')

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.wait(timeout=10)
        cls.log.close()
        cls.smtp.shutdown()
        cls.smtp.server_close()
        # Test-only generated key. Keep non-sensitive results, remove fixture credentials.
        (FIXTURE / 'localhost-key.pem').unlink(missing_ok=True)
        cls.config.unlink(missing_ok=True)

    def setUp(self):
        self.smtp.messages.clear()
        self.smtp.reject_data = False
        self.write_config()
        self.cookies = CookieJar()
        self.client = build_opener(HTTPCookieProcessor(self.cookies))

    def request(self, path, method='GET', fields=None, headers=None, file=None, raw=None, mime=None):
        h = {'Accept': 'application/json', 'Origin': self.origin}
        h.update(headers or {})
        body = raw
        if fields is not None:
            if file:
                body, mime = multipart(fields, **file)
            else:
                body, mime = urlencode(fields).encode(), 'application/x-www-form-urlencoded'
        if body is not None:
            h['Content-Type'] = mime or 'application/json'
        request = Request(self.origin + path, body, h, method=method)
        try:
            response = self.client.open(request, timeout=15)
        except HTTPError as error:
            response = error
        data = response.read()
        try:
            parsed = json.loads(data)
        except ValueError:
            parsed = {'non_json': data[:150].decode('utf-8', 'replace')}
        return response.status, parsed, dict(response.headers)

    def token(self):
        status, data, _ = self.request('/api/token.php')
        self.assertEqual(status, 200, data)
        self.assertRegex(data.get('csrf', ''), r'^[a-f0-9]{64}$')
        return data['csrf']

    def contact(self, **overrides):
        fields = {'kind': 'contact', 'csrf': self.token(), 'name': 'Website QA',
                  'email': 'visitor@example.org', 'company': 'QA company',
                  'topic': 'Cloud & DevOps', 'message': 'Please discuss a defined cloud migration engagement.',
                  'website': '', 'consent': '1'}
        fields.update(overrides)
        return fields

    def application(self, **overrides):
        fields = {'kind': 'application', 'csrf': self.token(), 'name': 'Career QA',
                  'email': 'career@example.org', 'role': 'Cloud Engineering', 'location': 'Remote',
                  'message': 'Local test introduction for a cloud engineering career.',
                  'website': '', 'consent': '1'}
        fields.update(overrides)
        return fields

    def assert_rejected(self, fields, status=422, file=None):
        response, data, _ = self.request('/api/submit.php', 'POST', fields, file=file)
        self.assertEqual(response, status, data)
        self.assertIs(data.get('success'), False, data)
        self.assertEqual(len(self.smtp.messages), 0)
        return data

    def test_01_token_has_private_session_and_no_store(self):
        status, data, headers = self.request('/api/token.php')
        self.assertEqual(status, 200, data)
        self.assertRegex(data.get('csrf', ''), r'^[a-f0-9]{64}$')
        self.assertIn('no-store', headers.get('Cache-Control', ''))
        self.assertIn('HttpOnly', headers.get('Set-Cookie', ''))
        self.assertIn('SameSite=Lax', headers.get('Set-Cookie', ''))
        self.assertEqual(headers.get('X-Content-Type-Options'), 'nosniff')

    def test_02_contact_delivers_over_tls_to_fixed_recipient(self):
        fields = self.contact(message='Scope <script>alert(1)</script> and cloud migration requirements.')
        status, data, _ = self.request('/api/submit.php', 'POST', fields)
        self.assertEqual(status, 200, data)
        self.assertIs(data.get('success'), True)
        self.assertEqual(len(self.smtp.messages), 1)
        delivery = self.smtp.messages[0]
        self.assertTrue(delivery['tls'])
        self.assertEqual(delivery['recipients'], ['<' + RECIPIENT + '>'])
        self.assertEqual(delivery['sender'], '<' + RECIPIENT + '>')
        mail = BytesParser(policy=policy.default).parsebytes(delivery['data'])
        self.assertEqual(mail['Reply-To'].addresses[0].addr_spec, 'visitor@example.org')
        html = mail.get_body(preferencelist=('html',)).get_content()
        self.assertIn('&lt;script&gt;', html)
        self.assertNotIn('<script>', html)
        self.assertIn('cloud migration', mail.get_body(preferencelist=('plain',)).get_content())

    def test_03_application_pdf_attached_without_public_storage(self):
        pdf = pdf_document()
        before = {str(p) for p in (ROOT / 'public_html').rglob('*') if p.is_file()}
        status, data, _ = self.request('/api/submit.php', 'POST', self.application(),
                                       file={'filename': 'qa-resume.pdf', 'data': pdf})
        self.assertEqual(status, 200, data)
        self.assertIs(data.get('success'), True)
        mail = BytesParser(policy=policy.default).parsebytes(self.smtp.messages[0]['data'])
        attachments = list(mail.iter_attachments())
        self.assertEqual(len(attachments), 1)
        self.assertEqual(attachments[0].get_content_type(), 'application/pdf')
        self.assertEqual(attachments[0].get_payload(decode=True), pdf)
        self.assertEqual(before, {str(p) for p in (ROOT / 'public_html').rglob('*') if p.is_file()})

    def test_04_missing_or_wrong_csrf_rejected(self):
        self.assert_rejected(self.contact(csrf=''), 403)
        self.assert_rejected(self.contact(csrf='0' * 64), 403)

    def test_05_successful_token_cannot_be_replayed(self):
        fields = self.contact()
        status, _, _ = self.request('/api/submit.php', 'POST', fields)
        self.assertEqual(status, 200)
        self.smtp.messages.clear()
        self.assert_rejected(fields, 403)

    def test_06_cross_origin_rejected(self):
        status, data, _ = self.request('/api/submit.php', 'POST', self.contact(), headers={'Origin': 'https://unrelated.example'})
        self.assertEqual(status, 403, data)
        self.assertEqual(len(self.smtp.messages), 0)

    def test_07_honeypot_rejected(self):
        self.assert_rejected(self.contact(website='spam.example'))

    def test_08_field_and_header_injection_rejected(self):
        for overrides in [{'email': 'visitor@example.org\r\nBcc: other@example.org'},
                          {'name': 'Visitor\nInjected header'}, {'kind': 'unknown'},
                          {'topic': 'Unknown service'}, {'name[]': 'array value', 'name': ''},
                          {'recipient': 'other@example.org'}, {'consent': ''},
                          {'email': 'invalid'}, {'message': 'short'}, {'message': 'A' * 5001}]:
            with self.subTest(fields=list(overrides)):
                self.assert_rejected(self.contact(**overrides))

    def test_09_array_input_rejected_without_php_warning(self):
        fields = self.contact()
        fields.pop('name')
        fields['name[]'] = 'Array name'
        result = self.assert_rejected(fields)
        self.assertIn('name', result.get('errors', {}))

    def test_10_upload_rejections(self):
        for filename, data in [('file.exe', pdf_document()), ('resume.pdf', b'not a PDF'),
                               ('resume.pdf', b''), ('resume.pdf', b'%PDF-1.4\ntruncated document'),
                               ('resume.pdf', b'%PDF-1.4\n' + b'0' * (5 * 1024 * 1024) + b'%%EOF')]:
            with self.subTest(filename=filename, size=len(data)):
                self.assert_rejected(self.application(), file={'filename': filename, 'data': data})
        self.assert_rejected(self.application())

    def test_11_extra_contact_attachment_rejected(self):
        self.assert_rejected(self.contact(), file={'filename': 'resume.pdf', 'data': pdf_document()})

    def test_12_wrong_methods_and_content_type(self):
        status, data, headers = self.request('/api/submit.php')
        self.assertEqual(status, 405, data)
        self.assertIn('POST', headers.get('Allow', ''))
        status, data, _ = self.request('/api/token.php', 'POST', {})
        self.assertEqual(status, 405, data)
        status, data, _ = self.request('/api/submit.php', 'POST', raw=b'{"kind":"contact"}')
        self.assertEqual(status, 415, data)

    def test_13_missing_configuration_is_honest_failure(self):
        fields = self.contact()
        self.config.unlink()
        self.assert_rejected(fields, 503)

    def test_14_smtp_failure_never_reports_success(self):
        self.smtp.reject_data = True
        self.assert_rejected(self.contact(), 503)

    def test_15_invalid_tls_certificate_never_delivers(self):
        self.write_config(ca_file='')
        self.assert_rejected(self.contact(), 503)

    def test_16_rate_limit_uses_remote_ip_not_forwarded_header(self):
        self.write_config(submit_limit=3)
        for i in range(3):
            fields = self.contact()
            status, data, _ = self.request('/api/submit.php', 'POST', fields,
                                           headers={'X-Forwarded-For': f'203.0.113.{i+1}'})
            self.assertEqual(status, 200, data)
        status, data, headers = self.request('/api/submit.php', 'POST', self.contact(),
                                             headers={'X-Forwarded-For': '203.0.113.99'})
        self.assertEqual(status, 429, data)
        self.assertIs(data.get('success'), False)
        self.assertIn('Retry-After', headers)
        self.assertEqual(len(self.smtp.messages), 3)


if __name__ == '__main__':
    QA.mkdir(parents=True, exist_ok=True)
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(FormIntegration)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    (QA / 'form-test-results.json').write_text(json.dumps({
        'tests': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors),
        'passed': result.wasSuccessful(), 'transport': 'Local authenticated SMTP with verified STARTTLS',
        'external_email': False, 'fixture': str(FIXTURE)
    }, indent=2), encoding='utf-8')
    raise SystemExit(0 if result.wasSuccessful() else 1)
