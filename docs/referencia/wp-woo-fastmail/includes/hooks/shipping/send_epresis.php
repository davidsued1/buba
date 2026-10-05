<?php
if (!defined('ABSPATH')) {
    exit;
}

use fastmail\helpers\Shipping;

add_action('woocommerce_order_status_changed', function ($order_id, $old_status, $new_status) {
    $order = wc_get_order($order_id);
    if (!$order) {
        return false;
    }

    $config_status = get_option('fastmail_order_status');
    $new_status = 'wc-' . $new_status;

    $shipping_methods = $order->get_shipping_methods();
    $is_correo = false;

    foreach ($shipping_methods as $shipping_method) {
        $method_id = $shipping_method->get_method_id();
        if ($method_id == "fastmail_shipping") {
            $is_correo = true;
            break;
        }
    }

    //Mercadopago ya esta cargando correctamente esta informacion
    // if ($order->get_payment_method() == 'woo-mercado-pago-basic' && $config_status == "wc-processing") {
    //     $order_notes = Helper::get_private_order_notes($order_id, '%Pago aprobado%');
    //     $order_notes2 = Helper::get_private_order_notes($order_id, '%a Procesando%', true);
    //     if (!$order_notes && !$order_notes2) {
    //         return false;
    //     }
    // }

    if (
        (
            $config_status === $new_status ||
            $config_status === $order->get_status()
        ) &&
        (
            $order->get_meta('fastmail_shipping', true) ||
            $is_correo
        ) &&
        !$order->get_meta('fastmail_shipping_tracking_number', true)
    ) {
        $shipping = new Shipping();
        $shipping->add_order($order, false);

        $shipping->send();
    }

}, 10, 3);
