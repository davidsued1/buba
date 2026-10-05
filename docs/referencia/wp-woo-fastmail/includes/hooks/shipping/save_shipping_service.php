<?php
if (!defined('ABSPATH')) {
    exit;
}

add_filter('woocommerce_checkout_update_order_meta', function($order_id = false) {
    $order = wc_get_order($order_id);

    if (!$order) return false;

    $chosen_shipping_method = WC()->session->get('chosen_shipping_methods');

    if (!is_array($chosen_shipping_method)) return false;

    $chosen_shipping_method = reset($chosen_shipping_method);

    $shipping = explode(':', $chosen_shipping_method);

    if (isset($shipping[0]) && $shipping[0] === 'fastmail_shipping') {
        $data = $shipping[1];
        fastmail\helpers\Helper::update_order_shipping_base64($order, $data);
    }
});
