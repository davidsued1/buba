<?php
if (!defined('ABSPATH')) {
    exit; 
}
/*Añadir metabox para Fastmail en la página de orden de WooCommerce*/
add_action('add_meta_boxes', function() {
    global $post;
    if (!$post) {
        return;
    }
    $order = wc_get_order($post->ID);
    if (!$order) return false;
    add_meta_box(
        'fastmail_carrier_box',
        'Fastmail',
        'fastmail_box_content',
        'shop_order',
        'side'
    );
});
/*Contenido de la metabox de Fastmail*/
function fastmail_box_content() {
    global $post, $fastmail_sdk;
    if (!$post) {
        return;
    }
    $order = wc_get_order($post->ID);
    if (!$order) return;
    $shipping_methods = $order->get_shipping_methods();
    $chosen_shipping_method = !empty($shipping_methods) ? reset($shipping_methods) : null;
    $chosen_shipping_method = $chosen_shipping_method ? json_decode(json_encode($chosen_shipping_method)) : null;
    $services = $fastmail_sdk->TodoServicios();
    $impacted = $order->get_meta('fastmail_shipping_tracking_number', true);
    $service_impacted = $order->get_meta('fastmail_shipping', true);
    $link_impact = admin_url('admin-ajax.php?action=fastmail_impact_order');
    $nonce_impact = wp_create_nonce('fastmail_impact_order');
    $service_impacted_retro = $order->get_meta('single_carrier_shipping_info', true);
    $impacted_retro = $order->get_meta('single_carrier_tracking_number', true);
    if ($chosen_shipping_method && isset($chosen_shipping_method->method_id) && $chosen_shipping_method->method_id === 'fastmail_shipping') {
        include_once plugin_dir_path(__FILE__) . '\orders\shipping_information_internal.php';
    } elseif ($impacted_retro) {
        include_once plugin_dir_path(__FILE__) . '\orders\shipping_information_external_retro.php';
    } else {
        try {
            fastmail_init();
            $fastmail_shipping = new WC_fastmail();
            $fastmail_shipping->order = $order;
            $prices = $fastmail_shipping->calculate_shipping_raw();
            if ($prices === false) {
                return;
            }
            include_once plugin_dir_path(__FILE__) . '\shipping_information_external.php';
        } catch (\Throwable $th) {
            echo '<center>' . __('No es posible conectar a Fastmail en este momento.', 'fastmail') . '</center>';
        }
    }
}