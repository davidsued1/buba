<?php

if (!defined('ABSPATH')) {
    exit; 
}

/**
 * Añadir acción en el menú de acciones masivas de órdenes
 */
add_filter('bulk_actions-edit-shop_order', function ($bulk_actions) {
    $bulk_actions['fastmail_bulk_orders_shipping'] = __('Envío Fastmail', 'fastmail');
    return $bulk_actions;
});

/**
 * Procesar la acción masiva de envío de órdenes
 */
add_action('admin_action_fastmail_bulk_orders_shipping', function () {
    if (!isset($_REQUEST['post']) || !is_array($_REQUEST['post'])) {
        return;
    }

    $orders = 0;
    $previously_sent = 0;
    $shipping = new \fastmail\helpers\Shipping();

    foreach ($_REQUEST['post'] as $order_id) {
        $order = wc_get_order($order_id);
        if(!$order->get_meta('fastmail_shipping_tracking_number', true))
        {

            if ($order && $order->get_meta('fastmail_shipping', true)) {
                $shipping->add_order($order, false);
                $orders++;
            } else {
                $previously_sent++;
            }
        }
        else
        {
            $previously_sent++;
        }
    }

    $response = $shipping->send();

    $location = add_query_arg(array(
        'post_type' => 'shop_order',
        'fastmail_shipment' => 1,
        'success' => isset($response['success']) ? (int) $response['success'] : 0,
        'errors' => isset($response['errors']) ? (int) $response['errors'] : 0,
        'error_fatal' => !isset($response['errors']) ? $response : '',
        'previously_sent' => $previously_sent,
        'ids' => implode(',', $_REQUEST['post']),
        'post_status' => 'all',
    ), 'edit.php');

    wp_redirect(admin_url($location));
    exit();
});

/**
 * Mostrar notificaciones de resultados de la acción masiva
 */
add_action('admin_notices', function () {
    global $pagenow, $typenow;

    if ($typenow == 'shop_order' && $pagenow == 'edit.php' && isset($_REQUEST['fastmail_shipment']) && $_REQUEST['fastmail_shipment'] == 1) {

        if (isset($_REQUEST['success']) && $_REQUEST['success']) {
            $success = sprintf(_n('Fastmail %s Orden enviada.', 'Fastmail %s Ordenes enviadas. ', $_REQUEST['success'], 'fastmail'), number_format_i18n($_REQUEST['success']));
            echo '<div class="notice notice-success is-dismissible"><p>' . $success . '</p></div>';
        }

        if (isset($_REQUEST['errors']) && $_REQUEST['errors']) {
            $errors = sprintf(_n('Fastmail %s Pedido error con.', 'Fastmail %s Pedidos con error. ', $_REQUEST['errors'], 'fastmail'), number_format_i18n($_REQUEST['errors']));
            echo '<div class="notice notice-error is-dismissible"><p>' . $errors . '</p></div>';
        }

        if (isset($_REQUEST['previously_sent']) && $_REQUEST['previously_sent']) {
            $previously_sent = sprintf(_n('Fastmail %s Orden previamente enviada.', 'Fastmail %s Ordenes previamente enviadas.', $_REQUEST['previously_sent'], 'fastmail'), number_format_i18n($_REQUEST['previously_sent']));
            echo '<div class="notice notice-warning is-dismissible"><p>' . $previously_sent . '</p></div>';
        }
    }
});
