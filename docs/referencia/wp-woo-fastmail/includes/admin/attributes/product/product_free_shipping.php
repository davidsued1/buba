<?php

if (!defined('ABSPATH')) {
    exit; 
}

/**
 * Añadir campo de envío gratuito al producto
 */
add_action('woocommerce_product_options_shipping', function() {
    global $post, $product_object, $fastmail_sdk;
    
    $fastmail_services = $fastmail_sdk->ServiciosCliente();
    $free_shipping = get_post_meta($product_object->get_id(), 'fastmail_free_shipping', true);

    woocommerce_wp_select(
        array(
            'id' => 'fastmail_free_shipping',
            'name' => 'fastmail_free_shipping[]',
            'label' => __('Envío gratis', 'fastmail'),
            'description' => __('Puedes elegir un único servicio gratuito o todos son gratuitos.', 'fastmail'),        
            'value' => json_decode($free_shipping, true),
            'desc_tip' => 'true',
            'options' => $fastmail_services,
            'custom_attributes' => array('multiple' => 'multiple')
        )
    );
}, 10);

/**
 * Guardar el valor de envío gratuito del producto
 */
add_action('woocommerce_process_product_meta', function($post_id) {
    if (isset($_POST['fastmail_free_shipping'])) {
        $fastmail_free_shipping = json_encode(array_map('sanitize_text_field', $_POST['fastmail_free_shipping']));
        update_post_meta($post_id, 'fastmail_free_shipping', $fastmail_free_shipping);
    }
});
