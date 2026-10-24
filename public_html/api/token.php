<?php
declare(strict_types=1);
require dirname(__DIR__, 2) . '/private/forms.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    ar_fail(405, 'Use GET to initialize this form.');
}
ar_token_endpoint();
