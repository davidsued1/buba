<?php

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

/**
 * Añadir campo de valor declarado al producto
 */
add_action('woocommerce_product_options_general_product_data', function() {
    global $post, $product_object;
    
    woocommerce_wp_text_input(
        array(
            'id'        => 'fastmail_declared_value',
            'value'     => get_post_meta($product_object->get_id(), 'fastmail_declared_value', true),
            'label'     => __('Valor declarado', 'fastmail') . ' (' . get_woocommerce_currency_symbol() . ')',
            'data_type' => 'price',
        )
    );
}, 10);

/**
 * Guardar el valor declarado del producto
 */
add_action('woocommerce_process_product_meta', function($post_id) {
    if (isset($_POST['fastmail_declared_value'])) {
        $fastmail_declared_value = sanitize_text_field($_POST['fastmail_declared_value']);
        update_post_meta($post_id, 'fastmail_declared_value', $fastmail_declared_value);
    }
});
