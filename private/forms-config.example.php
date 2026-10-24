<?php
declare(strict_types=1);

// Copy to forms-config.php in this private directory beside public_html.
// Never put mailbox credentials in JavaScript, HTML, Git or public_html.
return [
    'enabled' => false, // Change to true after configuring SMTP.
    'site_origin' => 'https://artechsusa.com',
    'runtime_dir' => __DIR__ . '/runtime',
    'rate_secret' => '', // Generate 32 random bytes and paste the 64-character hex value here.
    'submit_limit' => 5, // Attempts per IP in a rolling 15-minute window.
    'token_limit' => 60,
    'smtp_host' => 'smtp.hostinger.com', // Use the exact host shown for your mailbox provider.
    'smtp_port' => 465,
    'smtp_security' => 'ssl', // ssl for 465 or tls (verified STARTTLS) for 587.
    'smtp_username' => 'hr@artechsusa.com',
    'smtp_password' => '',
    'from_email' => 'hr@artechsusa.com', // An authenticated, company-owned sender.
    'ca_file' => '', // Normally leave empty: use the host's trusted certificate store.
];
