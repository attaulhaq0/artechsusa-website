<?php
declare(strict_types=1);
// Local router mirrors direct directory URLs; it is not part of the upload.
$root = realpath(__DIR__ . '/../public_html');
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = rawurldecode(is_string($uri) ? $uri : '/');
if (str_contains($path, "\0")) { http_response_code(400); exit; }
$candidate = realpath($root . '/' . ltrim($path, '/'));
if ($candidate !== false && ($candidate === $root || str_starts_with($candidate, $root . DIRECTORY_SEPARATOR))) {
    if (is_file($candidate)) {
        if ($path === '/404.html') { http_response_code(404); header('Content-Type: text/html; charset=utf-8'); readfile($candidate); return true; }
        return false;
    }
    if (is_dir($candidate) && is_file($candidate . '/index.html')) {
        if (!str_ends_with($path, '/')) { header('Location: ' . $path . '/', true, 301); return true; }
        header('Content-Type: text/html; charset=utf-8'); readfile($candidate . '/index.html'); return true;
    }
}
http_response_code(404); header('Content-Type: text/html; charset=utf-8'); readfile($root . '/404.html');
return true;
