<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Acción para imprimir el remito desde la URL de administración
 */
add_action('admin_init', function() {
    if (isset($_GET['fastmail_print_reference'])) {
        $order_id = sanitize_text_field($_GET['fastmail_print_reference']);

        if (!empty($order_id)) {
            $shipping = new \fastmail\helpers\Shipping();
            $shipping->add_order_id($order_id);
            $shipping->print_refers();

            exit();
        }
    }
});
