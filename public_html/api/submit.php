<?php
declare(strict_types=1);
require dirname(__DIR__, 2) . '/private/forms.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    ar_fail(405, 'Submit this form using POST.');
}
$type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
if (!in_array($type, ['multipart/form-data', 'application/x-www-form-urlencoded'], true)) {
    ar_fail(415, 'Please submit using the website form.');
}
ar_submit_endpoint();
