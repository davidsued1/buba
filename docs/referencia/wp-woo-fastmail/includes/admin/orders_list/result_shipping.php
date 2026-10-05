<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Añadir columna "Guía Fastmail" a la lista de órdenes en WooCommerce
 */

if (!function_exists("fastmail_orders_columns")) {
    function fastmail_orders_columns($columns)
    {
        $reordered_columns = array();

        foreach ($columns as $key => $column) {
            $reordered_columns[$key] = $column;
            if ($key == 'order_status') {
                $reordered_columns['shipping_fastmail'] = __('Guía Fastmail', 'fastmail');
            }
        }

        return $reordered_columns;
    }
}

add_filter('manage_woocommerce_page_wc-orders_columns', "fastmail_orders_columns", 20);
add_filter('manage_edit-shop_order_columns', "fastmail_orders_columns", 20);

/**
 * Mostrar contenido en la columna "Guía Fastmail"
 */

if (!function_exists("fastmail_orders_custom_column")) {
    function fastmail_orders_custom_column($column,$post_id){
        if ($column === 'shipping_fastmail') {
            if(is_object($post_id)) {
                $guide=$post_id->get_meta('fastmail_shipping_tracking_number', true);
            }else{
                $guide = get_post_meta($post_id, 'fastmail_shipping_tracking_number', true);
            }

            if (!empty($guide)) {
                echo esc_html($guide);
            } else {
                $guide = get_post_meta($post_id, 'single_carrier_tracking_number', true);
                if (!empty($guide)) {
                    echo esc_html($guide);
                } else {
                    $error = json_decode(base64_decode(get_post_meta($post_id, 'fastmail_shipping_error', true)));
                    if (!empty($error)) {
                        echo '<span style="color:red;">' . esc_html($error->message) . '</span>';
                    } else {
                        echo esc_html(__('Guía no encontrada', 'fastmail'));
                    }
                }
            }
        }
    }
}

add_action('manage_shop_order_posts_custom_column', "fastmail_orders_custom_column", 20, 2);
add_action('manage_woocommerce_page_wc-orders_custom_column', "fastmail_orders_custom_column", 20, 2);
