<?php

if (!defined('ABSPATH')) {
    exit; 
}

/**
 * Añadir campo de sucursal local al producto
 */
add_action('woocommerce_product_options_shipping', function() {
    global $product_object;
    
    $home = get_post_meta($product_object->get_id(), 'fastmail_product_home_branch', true);

    woocommerce_wp_text_input(
        array(
            'id'          => 'fastmail_product_home_branch',
            'value'       => $home,
            'label'       => __('Sucursal local', 'fastmail'),
            'data_type'   => 'price',
            'description' => __('Si se trata de un pack de productos, especificar cuantas unidades componen el pack.', 'fastmail'),
            'desc_tip'    => 'true',
            'type'        => 'number'
        )
    );
}, 10);

/**
 * Guardar el valor de sucursal local del producto
 */
add_action('woocommerce_process_product_meta', function($post_id) {
    if (isset($_POST['fastmail_product_home_branch'])) {
        $fastmail_product_home_branch = intval($_POST['fastmail_product_home_branch']);
        update_post_meta($post_id, 'fastmail_product_home_branch', $fastmail_product_home_branch);
    }
});
