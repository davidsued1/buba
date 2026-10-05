<?php
if (!defined('ABSPATH')) {
    exit;
}

add_shortcode('fastmail_tracking', function ($arg) {
    global $product;
    $nonce = wp_create_nonce("fastmail_consult_tracking_nonce");
    $link = admin_url('admin-ajax.php?action=fastmail_consult_tracking');
    include 'shortcode_tracking_view.php';
});
?>
