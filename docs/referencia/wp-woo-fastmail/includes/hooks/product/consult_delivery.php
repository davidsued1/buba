<?php
if (!defined('ABSPATH')) {
    exit;
}

add_filter(get_option('fastmail_shipping_on_product'), function () {
    global $product;
    $nonce = wp_create_nonce("fastmail_consult_delivery_nonce");
    $link = admin_url('admin-ajax.php?action=fastmail_consult_delivery');
    require_once 'consult_delivery_view.php';
});
