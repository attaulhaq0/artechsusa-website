<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

const ARTECH_RECIPIENT = 'hr@artechsusa.com';
const ARTECH_MAX_RESUME = 5 * 1024 * 1024;
const ARTECH_RATE_WINDOW = 900;

function ar_response(int $status, array $data): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private, max-age=0');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function ar_fail(int $status, string $message, array $errors = []): never
{
    ar_response($status, ['success' => false, 'message' => $message, 'errors' => (object)$errors]);
}

function ar_config(): array
{
    $path = getenv('ARTECH_CONFIG_FILE') ?: __DIR__ . '/forms-config.php';
    if (!is_file($path)) {
        ar_fail(503, 'The form is temporarily unavailable. Please contact ' . ARTECH_RECIPIENT . '.');
    }
    try {
        $config = require $path;
        if (!is_array($config) || ($config['enabled'] ?? false) !== true) {
            throw new RuntimeException('Configuration is not enabled');
        }
        foreach (['site_origin', 'runtime_dir', 'rate_secret', 'smtp_host', 'smtp_username', 'smtp_password', 'from_email'] as $key) {
            if (!isset($config[$key]) || !is_string($config[$key]) || $config[$key] === '' || preg_match('/[\x00-\x1f\x7f]/', $config[$key])) {
                throw new RuntimeException('Incomplete configuration');
            }
        }
        $origin = parse_url($config['site_origin']);
        if (!isset($origin['scheme'], $origin['host']) || !in_array($origin['scheme'], ['http', 'https'], true)
            || isset($origin['user']) || isset($origin['query']) || isset($origin['fragment'])
            || !in_array($origin['path'] ?? '', ['', '/'], true)) {
            throw new RuntimeException('Invalid origin');
        }
        if ($origin['scheme'] !== 'https' && !in_array($origin['host'], ['127.0.0.1', 'localhost'], true)) {
            throw new RuntimeException('HTTPS required');
        }
        if (strlen($config['rate_secret']) < 32
            || !filter_var($config['from_email'], FILTER_VALIDATE_EMAIL)
            || !in_array($config['smtp_security'] ?? '', ['ssl', 'tls'], true)
            || !is_int($config['smtp_port'] ?? null) || $config['smtp_port'] < 1 || $config['smtp_port'] > 65535) {
            throw new RuntimeException('Invalid mail configuration');
        }
        $fromDomain = strtolower(substr(strrchr($config['from_email'], '@'), 1));
        if (!in_array($fromDomain, ['artechsusa.com'], true)) {
            throw new RuntimeException('Company sender required');
        }
        $config['site_origin'] = rtrim($config['site_origin'], '/');
        $runtime = $config['runtime_dir'];
        if (!is_dir($runtime) && !mkdir($runtime, 0700, true) && !is_dir($runtime)) {
            throw new RuntimeException('Runtime directory unavailable');
        }
        $resolved = realpath($runtime);
        $webRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? __DIR__ . '/../public_html');
        if (!$resolved || ($webRoot && str_starts_with(strtolower(str_replace('\\', '/', $resolved)) . '/', strtolower(str_replace('\\', '/', $webRoot)) . '/'))) {
            throw new RuntimeException('Private runtime required');
        }
        $config['runtime_dir'] = $resolved;
        return $config;
    } catch (Throwable) {
        ar_fail(503, 'The form is temporarily unavailable. Please contact ' . ARTECH_RECIPIENT . '.');
    }
}

function ar_check_origin(array $config): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (($origin !== '' && rtrim($origin, '/') !== $config['site_origin'])
        || ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') {
        ar_fail(403, 'Please submit this form from the AR TECH INC website.');
    }
}

function ar_session(array $config): void
{
    $folder = $config['runtime_dir'] . '/sessions';
    if (!is_dir($folder) && !mkdir($folder, 0700, true) && !is_dir($folder)) {
        ar_fail(503, 'The form is temporarily unavailable. Please use email.');
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', '1800');
    session_name('ARTECH_FORM');
    session_save_path($folder);
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/',
        'secure' => str_starts_with($config['site_origin'], 'https://'),
        'httponly' => true, 'samesite' => 'Lax',
    ]);
    if (!session_start()) {
        ar_fail(503, 'The form could not be initialized. Please use email.');
    }
}

function ar_rate_limit(array $config, string $purpose): void
{
    // REMOTE_ADDR is supplied by the host. Do not trust a client-controlled forwarded header.
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = hash_hmac('sha256', $purpose . ':' . $ip, $config['rate_secret']);
    $folder = $config['runtime_dir'] . '/limits';
    if (!is_dir($folder) && !mkdir($folder, 0700, true) && !is_dir($folder)) {
        ar_fail(503, 'The form is temporarily unavailable. Please use email.');
    }
    $file = fopen($folder . '/' . $key . '.json', 'c+');
    if (!$file || !flock($file, LOCK_EX)) {
        ar_fail(503, 'The form is temporarily unavailable. Please use email.');
    }
    $now = time();
    $entries = json_decode(stream_get_contents($file), true);
    $entries = is_array($entries) ? array_values(array_filter($entries, fn($t) => is_int($t) && $t > $now - ARTECH_RATE_WINDOW)) : [];
    $limit = max(1, min(200, (int)($config[$purpose . '_limit'] ?? ($purpose === 'submit' ? 5 : 60))));
    $blocked = count($entries) >= $limit;
    if (!$blocked) {
        $entries[] = $now;
    }
    rewind($file);
    ftruncate($file, 0);
    fwrite($file, json_encode($entries));
    fflush($file);
    flock($file, LOCK_UN);
    fclose($file);
    if ($blocked) {
        $retry = max(1, ($entries[0] ?? $now) + ARTECH_RATE_WINDOW - $now);
        header('Retry-After: ' . $retry);
        ar_fail(429, 'Too many attempts. Please try again in a few minutes or contact us by email.');
    }
    // Bound retention of anonymous anti-spam state without a cron or database.
    if (random_int(1, 40) === 1) {
        foreach (new DirectoryIterator($folder) as $entry) {
            if ($entry->isFile() && preg_match('/^[a-f0-9]{64}\.json$/', $entry->getFilename()) && $entry->getMTime() < $now - 86400) {
                @unlink($entry->getPathname());
            }
        }
    }
}

function ar_fields(): array
{
    $errors = [];
    $values = [];
    $allowed = ['kind', 'csrf', 'name', 'email', 'company', 'topic', 'role', 'location', 'message', 'consent', 'website'];
    foreach ($_POST as $key => $value) {
        if (!in_array($key, $allowed, true)) {
            $errors['form'] = 'Please reload the form and try again.';
        } elseif (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) {
            $errors[$key] = 'Please enter a valid value.';
        }
    }
    foreach ($allowed as $key) {
        $values[$key] = isset($_POST[$key]) && is_string($_POST[$key]) ? trim($_POST[$key]) : '';
    }
    $rules = ['name' => [2, 160], 'email' => [3, 254], 'message' => [10, 5000],
              'company' => [0, 160], 'location' => [0, 160], 'topic' => [0, 160], 'role' => [0, 160]];
    foreach ($rules as $key => [$min, $max]) {
        $value = $values[$key];
        $badControl = $key === 'message' ? '/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/' : '/[\x00-\x1f\x7f]/';
        if (mb_strlen($value) < $min || mb_strlen($value) > $max || preg_match($badControl, $value)) {
            $errors[$key] = $key === 'message' ? 'Please provide between 10 and 5,000 characters.' : 'Please enter a valid ' . $key . '.';
        }
    }
    if (!filter_var($values['email'], FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Enter a valid email address.';
    }
    if (!in_array($values['kind'], ['contact', 'application'], true)) {
        $errors['form'] = 'Please reload the form and try again.';
    }
    if ($values['consent'] !== '1') {
        $errors['consent'] = 'Please read the Privacy Notice and agree before submitting.';
    }
    if ($values['website'] !== '') {
        $errors['form'] = 'The submission could not be accepted.';
    }
    if ($values['kind'] === 'contact') {
        $topics = ['Technology Consulting', 'Cloud & DevOps', 'Data & AI', 'Software Engineering',
                   'Managed IT & Security', 'Enterprise Platforms', 'Technology Staffing', 'General Enquiry'];
        if (!in_array($values['topic'], $topics, true)) {
            $errors['topic'] = 'Choose a topic from the list.';
        }
        if ($_FILES !== []) {
            $errors['form'] = 'This enquiry form does not accept attachments.';
        }
    } else {
        $roles = ['Cloud Engineering', 'Data Engineering', 'Software Engineering', 'Enterprise Platforms',
                  'IT Operations & Security', 'Other Technology Role'];
        if (!in_array($values['role'], $roles, true)) {
            $errors['role'] = 'Choose a career interest from the list.';
        }
    }
    if ($errors !== []) {
        ar_fail(422, 'Please check the highlighted fields.', $errors);
    }
    return $values;
}

function ar_resume(): array
{
    $error = 'Upload a complete PDF resume no larger than 5 MB.';
    $file = $_FILES['resume'] ?? null;
    if (count($_FILES) !== 1 || !is_array($file)
        || !is_string($file['name'] ?? null) || !is_string($file['tmp_name'] ?? null)
        || !is_int($file['size'] ?? null) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK
        || $file['size'] < 1 || $file['size'] > ARTECH_MAX_RESUME
        || !preg_match('/\.pdf$/i', $file['name']) || preg_match('/[\x00-\x1f\x7f]/', $file['name'])
        || !is_uploaded_file($file['tmp_name'])) {
        ar_fail(422, 'Please check your resume file.', ['resume' => $error]);
    }
    $path = $file['tmp_name'];
    if (filesize($path) !== $file['size'] || (new finfo(FILEINFO_MIME_TYPE))->file($path) !== 'application/pdf') {
        ar_fail(422, 'Please check your resume file.', ['resume' => $error]);
    }
    $handle = fopen($path, 'rb');
    if (!$handle) {
        ar_fail(422, 'Please select your PDF again.', ['resume' => $error]);
    }
    $signature = fread($handle, 8);
    fseek($handle, max(0, $file['size'] - 2048));
    $end = stream_get_contents($handle);
    fclose($handle);
    if (!preg_match('/^%PDF-[12]\.[0-9]/', $signature) || !preg_match('/%%EOF\s*$/s', $end)) {
        ar_fail(422, 'Please check your resume file.', ['resume' => $error]);
    }
    return ['path' => $path, 'filename' => 'career-resume.pdf'];
}

function ar_send(array $config, array $fields, ?array $resume): bool
{
    require_once __DIR__ . '/vendor/phpmailer/Exception.php';
    require_once __DIR__ . '/vendor/phpmailer/PHPMailer.php';
    require_once __DIR__ . '/vendor/phpmailer/SMTP.php';
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = $config['smtp_host'];
        $mail->Port = $config['smtp_port'];
        $mail->SMTPAuth = true;
        $mail->Username = $config['smtp_username'];
        $mail->Password = $config['smtp_password'];
        $mail->SMTPSecure = $config['smtp_security'];
        $mail->SMTPAutoTLS = true;
        $mail->Timeout = 12;
        $mail->Timelimit = 20;
        $mail->SMTPDebug = 0;
        $tls = ['verify_peer' => true, 'verify_peer_name' => true, 'allow_self_signed' => false];
        if (is_string($config['ca_file'] ?? null) && $config['ca_file'] !== '') {
            $tls['cafile'] = $config['ca_file'];
        }
        $mail->SMTPOptions = ['ssl' => $tls];
        $mail->CharSet = 'UTF-8';
        $mail->setFrom($config['from_email'], 'AR TECH INC Website');
        $mail->addAddress(ARTECH_RECIPIENT, 'AR TECH INC');
        $mail->addReplyTo($fields['email'], $fields['name']);
        $application = $fields['kind'] === 'application';
        $mail->Subject = 'AR TECH INC | ' . ($application ? 'Career introduction | ' . $fields['role'] : 'Website enquiry | ' . $fields['topic']);
        $rows = ['Name' => $fields['name'], 'Email' => $fields['email']];
        if ($application) {
            $rows['Career interest'] = $fields['role'];
            $rows['Location'] = $fields['location'];
        } else {
            $rows['Company'] = $fields['company'];
            $rows['Topic'] = $fields['topic'];
        }
        $rows['Introduction'] = $fields['message'];
        $rows['Privacy consent'] = 'Accepted at ' . gmdate('Y-m-d H:i:s') . ' UTC';
        $html = '<div style="font-family:Arial,sans-serif;max-width:680px;color:#001429"><h1 style="font-size:24px">'
                . ($application ? 'Career introduction' : 'New website enquiry') . '</h1><table style="width:100%;border-collapse:collapse">';
        $plain = "AR TECH INC website submission\n\n";
        foreach ($rows as $label => $value) {
            if ($value === '') {
                continue;
            }
            $html .= '<tr><th style="text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #dce1f0">' . htmlspecialchars($label, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
                     . '</th><td style="padding:12px;border-bottom:1px solid #dce1f0">' . nl2br(htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')) . '</td></tr>';
            $plain .= $label . ': ' . $value . "\n\n";
        }
        $mail->isHTML(true);
        $mail->Body = $html . '</table><p style="font-size:12px">Use Reply to contact the person who submitted this form.</p></div>';
        $mail->AltBody = $plain;
        if ($resume) {
            $mail->addAttachment($resume['path'], $resume['filename'], PHPMailer::ENCODING_BASE64, 'application/pdf');
        }
        return $mail->send();
    } catch (Throwable) {
        // Do not log SMTP credentials, message contents or applicant data.
        error_log('AR TECH INC form: authenticated SMTP delivery failed.');
        return false;
    } finally {
        $mail->smtpClose();
        if ($resume && is_file($resume['path'])) {
            @unlink($resume['path']);
        }
    }
}

function ar_token_endpoint(): never
{
    $config = ar_config();
    ar_check_origin($config);
    ar_rate_limit($config, 'token');
    ar_session($config);
    if (!isset($_SESSION['csrf'], $_SESSION['csrf_expiry']) || $_SESSION['csrf_expiry'] < time()) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        $_SESSION['csrf_expiry'] = time() + 1800;
    }
    $token = $_SESSION['csrf'];
    session_write_close();
    ar_response(200, ['csrf' => $token]);
}

function ar_submit_endpoint(): never
{
    $config = ar_config();
    ar_check_origin($config);
    ar_rate_limit($config, 'submit');
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 7 * 1024 * 1024) {
        ar_fail(413, 'The submission is too large. Use a PDF resume no larger than 5 MB.');
    }
    ar_session($config);
    $token = $_POST['csrf'] ?? null;
    if (!is_string($token) || !isset($_SESSION['csrf'], $_SESSION['csrf_expiry'])
        || $_SESSION['csrf_expiry'] < time() || !hash_equals($_SESSION['csrf'], $token)) {
        session_write_close();
        ar_fail(403, 'Your form session expired. Please try submitting again.');
    }
    $fields = ar_fields();
    $resume = $fields['kind'] === 'application' ? ar_resume() : null;
    // Consume before the SMTP boundary so a concurrent replay cannot send twice.
    unset($_SESSION['csrf'], $_SESSION['csrf_expiry']);
    session_write_close();
    if (!ar_send($config, $fields, $resume)) {
        ar_fail(503, 'We could not confirm delivery. Please try again or contact ' . ARTECH_RECIPIENT . '.');
    }
    ar_response(200, ['success' => true, 'message' => $fields['kind'] === 'application'
        ? 'Your resume has been sent to AR TECH INC.' : 'Your enquiry has been sent to AR TECH INC.']);
}
