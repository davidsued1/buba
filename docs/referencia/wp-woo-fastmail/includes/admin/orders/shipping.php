<?php
if (!defined('ABSPATH')) {
    exit;
}
/*Contenido de la metabox de Fastmail*/
function fastmail_box_content_woo($post)
{
    global $fastmail_sdk;
    @$post_id = is_object($post) ? $post->ID : get_the_ID();
    $order = wc_get_order($post_id);
    if (!$order) {
        error_log("No se encontró la orden");
        return;
    }
    $services = $fastmail_sdk->TodoServicios();
    $impacted = $order->get_meta('fastmail_shipping_tracking_number', true);
    $service_impacted = $order->get_meta('fastmail_shipping', true);
    $link_impact = admin_url('admin-ajax.php?action=fastmail_impact_order');
    $nonce_impact = wp_create_nonce('fastmail_impact_order');
    $service_impacted_retro = $order->get_meta('single_carrier_shipping_info', true);
    $impacted_retro = $order->get_meta('single_carrier_tracking_number', true);
    $shipping_methods = (new fastmail\helpers\Shipping)->shipment_info($order);
    $chosen_shipping_method = new stdClass;
    $chosen_shipping_method->method_title = $shipping_methods->codigo_servicio !== false ? "Fastmail" : "N/C";
    if ($shipping_methods->manual == false && $shipping_methods->codigo_servicio != false) {
        include_once __DIR__ . '/shipping_information_internal.php';
    } elseif ($impacted_retro) {
        include_once __DIR__ . '/shipping_information_external_retro.php';
    } else {
        try {
            fastmail_init();
            $fastmail_shipping = new WC_fastmail();
            $fastmail_shipping->order = $order;
            $prices = $fastmail_shipping->calculate_shipping_raw();
            if ($prices === false) {
                return;
            }
            include_once __DIR__ . '/shipping_information_external.php';
        } catch (\Throwable $th) {
            echo '<center>' . __('No es posible conectar a Fastmail en este momento.', 'fastmail') . '</center>';
        }
    }
}
/*Añadir metabox para Fastmail en la página de orden de WooCommerce*/
if (!function_exists('fastmail_add_meta_boxes')) {
    function fastmail_add_meta_boxes()
    {
        add_meta_box(
            'fastmail_carrier_box',
            'Fastmail',
            'fastmail_box_content_woo',
            wc_get_page_screen_id('shop-order'),
            'side'
        );

        add_meta_box(
            'fastmail_carrier_box',
            'Fastmail',
            'fastmail_box_content_woo',
            'shop_order',
            'side'
        );
    }
}
add_action('add_meta_boxes', 'fastmail_add_meta_boxes');
add_action('add_meta_boxes_shop_order', 'fastmail_add_meta_boxes'); // Para compatibilidad con HPOS