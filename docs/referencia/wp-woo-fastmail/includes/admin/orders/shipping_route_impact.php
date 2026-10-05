<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Acción AJAX para impactar la orden en Fastmail
 */
add_action('wp_ajax_fastmail_impact_order', function () {
    if (!isset($_POST['order']) || !check_ajax_referer('fastmail_impact_order', 'nonce', false)) {
        wp_send_json_error(['error' => ['message' => __('Solicitud no válida', 'fastmail')]]);
        wp_die();
    }

    $order_id = intval($_POST['order']);
    $order = wc_get_order($order_id);

    if (!$order) {
        wp_send_json_error(['error' => __('Orden no encontrada', 'fastmail')]);
        wp_die();
    }

    $shipping = new \fastmail\helpers\Shipping();

    if(!$order->get_meta('fastmail_shipping_tracking_number', true))
    {
        if ($order->get_meta('fastmail_shipping', true)) {
            $shipping->add_order($order, false);
            $sucursal = null;
        } else {
            $servicio = $_POST['fastmail_service'];
            \fastmail\helpers\Helper::update_order_shipping_base64($order, $servicio);
            $sucursal = $servicio->sucursal;
            $shipping->add_order($order);
        }
    
        $response = $shipping->send();
    
        if (isset($response['response'][0])) {
            wp_send_json_success($response['response'][0]);
        } else {
            wp_send_json_error(['error' => $response]);
        }
    }

    wp_die();
});
