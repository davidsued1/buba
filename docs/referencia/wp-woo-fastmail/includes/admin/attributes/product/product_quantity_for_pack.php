<?php

if (!defined('ABSPATH')) {
    exit; 
}

/**
 * Añadir campo de cantidad de productos en el pack
 */
add_action('woocommerce_product_options_shipping', function() {
    global $product_object;

    $quantity = get_post_meta($product_object->get_id(), 'fastmail_products_for_pack', true);

    woocommerce_wp_text_input(
        array(
            'id'          => 'fastmail_products_for_pack',
            'value'       => $quantity ? $quantity : 1,
            'label'       => __('Pack', 'fastmail'),
            'data_type'   => 'price',
            'description' => __('Si se trata de un pack de productos, especificar cuántas unidades componen el pack.', 'fastmail'),
            'desc_tip'    => 'true',
            'type'        => 'number'
        )
    );
}, 10);

/**
 * Guardar el valor de cantidad de productos en el pack
 */
add_action('woocommerce_process_product_meta', function($post_id) {
    if (isset($_POST['fastmail_products_for_pack'])) {
        $fastmail_products_for_pack = intval($_POST['fastmail_products_for_pack']);
        update_post_meta($post_id, 'fastmail_products_for_pack', $fastmail_products_for_pack);
    }
});
