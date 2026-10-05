<?php
if (!defined('ABSPATH')) {
    exit;
}
/*
add_filter(
    'woocommerce_checkout_order_processed',
    'clear_cache',
    10,
    3
);
*/
function clear_cache($order_id)
{
    $order = wc_get_order($order_id);
    if (!$order) {
        return;
    }
    $shipping_methods = $order->get_shipping_methods();
    if (!WC()->cart || empty(WC()->cart->get_shipping_packages())) {
        return;
    }
    $packages = WC()->cart->get_shipping_packages();
    foreach ($packages as $key => $value) {
        $has_shipping = $shipping_methods ? true : false;
        $shipping_session = "shipping_for_package_$key";
        if ($has_shipping === true) {
            unset(WC()->session->$shipping_session);
        }
    }
}
/*
$packages = WC()->cart->get_shipping_packages();
foreach ($packages as $key => $value) {
    $shipping_session = "shipping_for_package_$key";
    if (isset(WC()->session->$shipping_session)) {
        unset(WC()->session->$shipping_session);
    }
}
*/
