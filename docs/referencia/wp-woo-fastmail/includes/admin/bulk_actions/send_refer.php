<?php

if (!defined('ABSPATH')) {
    exit; 
}

/**
 * Añadir acción en el menú de acciones masivas de órdenes
 */
add_filter('bulk_actions-edit-shop_order', function ($bulk_actions) {
    $bulk_actions['fastmail_bulk_orders_refer'] = __('Remito Fastmail', 'fastmail');
    return $bulk_actions;
});

/**
 * Procesar la acción masiva de impresión de remitos
 */
add_action('admin_action_fastmail_bulk_orders_refer', function () {
    if (!isset($_REQUEST['post']) || !is_array($_REQUEST['post'])) {
        return;
    }

    $shipping = new \fastmail\helpers\Shipping();

    foreach ($_REQUEST['post'] as $order_id) {
        $tracking = get_post_meta($order_id, 'fastmail_shipping_tracking_number', true);
        if (!$tracking) {
            $tracking = get_post_meta($order_id, 'single_carrier_tracking_number', true);
        }
        if ($tracking) {
            $shipping->add_order_id($tracking);
        }
    }

    $shipping->print_refers();
});
