<?php

if (!defined('ABSPATH')) {
    exit; 
}

global $fastmail_sdk;

$status = $fastmail_sdk->VefificarConexion();

$settings_presis[] = array(
    'name' => __('Fastmail Ajustes', 'fastmail'),
    'type' => 'title',
    'desc' => __('Las siguientes opciones se utilizan para configurar Fastmail', 'fastmail'),
    'id' => 'fastmail'
);

if (isset($status->cliente) && $status->cliente !== 'Error') {
    // Add Title to the Settings
    $settings_presis[] = array('name' => __('Conectado', 'fastmail'), 'type' => 'title', 'id' => 'fastmail');
} else {
    $settings_presis[] = array('name' => __('No Conectado', 'fastmail'), 'type' => 'title', 'id' => 'fastmail');
}

// Add token field option
$settings_presis[] = array(
    'name' => __('Token', 'fastmail'),
    'desc_tip' => __('Token de conexion para Fastmail', 'fastmail'),
    'id' => 'fastmail_token',
    'type' => 'text',
    'desc' => __('Este token es proporcionado por Fastmail', 'fastmail'),
);

// Add Postal Code
$settings_presis[] = array(
    'name' => __('Codigo Postal', 'fastmail'),
    'id' => 'fastmail_postal_code',
    'type' => 'number',
    'desc' => __('Se utiliza como punto de partida de los productos.', 'fastmail'),
);

// Add Branch Code field
$settings_presis[] = array(
    'name' => __('Código de sucursal', 'fastmail'),
    'desc_tip' => __('Código de sucursal en Fastmail', 'fastmail'),
    'id' => 'fastmail_branch_code',
    'type' => 'text',
    'desc' => __('Código de sucursal en Fastmail', 'fastmail'),
);

if (isset($status->cliente) && $status->cliente !== 'Error') {
    $fastmail_sdk->VaciarCache();

    $settings_presis[] = array(
        'name' => __('Estado de la orden', 'fastmail'),
        'desc_tip' => __('Solo aplica para envíos de LV Demo', 'fastmail'),
        'id' => 'fastmail_order_status',
        'type' => 'select',
        'options' => wc_get_order_statuses(),
        'desc' => __('Cualquier pedido en este estado será enviado automáticamente.', 'fastmail'),
    );

    $yes_no = [
        'yes' => __('Si', 'fastmail'),
        'no' => __('No', 'fastmail'),
    ];

    $hook_product_page = [
        '0' => __('No', 'fastmail'),
        'woocommerce_before_single_product' => __('Antes de un solo producto', 'fastmail'),
        'woocommerce_before_single_product_summary' => __('Antes del resumen de un solo producto', 'fastmail'),
        'woocommerce_single_product_summary' => __('Resumen de un solo producto', 'fastmail'),
        'woocommerce_before_add_to_cart_form' => __('Antes de agregar al formulario de carrito', 'fastmail'),
        'woocommerce_product_thumbnails' => __('Miniaturas de productos (puede que no funcionen)', 'fastmail'),
        'woocommerce_before_variations_form' => __('Antes del formulario de variaciones', 'fastmail'),
        'woocommerce_before_add_to_cart_button' => __('Antes del botón Agregar al carrito', 'fastmail'),
        'woocommerce_before_single_variation' => __('Antes de la variación única', 'fastmail'),
        'woocommerce_single_variation' => __('Variación única', 'fastmail'),
        'woocommerce_before_add_to_cart_quantity' => __('Antes de Añadir la cantidad al carrito', 'fastmail'),
        'woocommerce_after_add_to_cart_quantity' => __('Después de añadir la cantidad al carrito', 'fastmail'),
        'woocommerce_after_single_variation' => __('Después de una sola variación', 'fastmail'),
        'woocommerce_after_add_to_cart_button' => __('Después del botón Agregar al carrito', 'fastmail'),
        'woocommerce_after_variations_form' => __('Después del formulario de variaciones', 'fastmail'),
        'woocommerce_after_add_to_cart_form' => __('Después del formulario Agregar al carrito', 'fastmail'),
        'woocommerce_product_meta_start' => __('Meta de inicio del producto', 'fastmail'),
        'woocommerce_product_meta_end' => __('Final de meta del producto', 'fastmail'),
        'woocommerce_share' => __('Compartir', 'fastmail'),
        'woocommerce_after_single_product_summary' => __('Después del resumen de un solo producto', 'fastmail'),
        'woocommerce_after_single_product' => __('Después de un solo producto', 'fastmail'),
    ];

    $settings_presis[] = array(
        'name' => __('Verifique el envío en la página del producto', 'fastmail'),
        'desc_tip' => __('Solo aplica para envíos LV Demo', 'fastmail'),
        'id' => 'fastmail_shipping_on_product',
        'type' => 'select',
        'options' => $hook_product_page,
        'desc' => __('Puedes deshabilitarlo o seleccionar en qué hook quieres visualizarlo, te recomendamos probar uno a uno para determinar cuál es el más conveniente.', 'fastmail'),
    );

    $settings_presis[] = array(
        'name' => __('Envío gratis', 'fastmail'),
        'desc_tip' => __('Toma el precio de todo el carrito, en caso de hacer una consulta sobre un producto, toma solo el producto.', 'fastmail'),
        'id' => 'fastmail_free_shipping',
        'options' => $yes_no,
        'type' => 'select',
        'desc' => __('Habilitar la posibilidad de envío gratis.', 'fastmail'),
    );

    $settings_presis[] = array(
        'name' => __('Envío gratis después de', 'fastmail'),
        'desc_tip' => __('Toma el precio de todo el carrito, en caso de hacer una consulta sobre un producto, toma solo el producto.', 'fastmail'),
        'id' => 'fastmail_free_shipping_after',
        'type' => 'number',
        'desc' => __('Posibilidad de envío gratuito en tienda teniendo un valor igual o superior al especificado.', 'fastmail'),
    );

    $fastmail_services = $fastmail_sdk->ServiciosCliente();
    $settings_presis[] = array(
        'name' => __('Envío gratis', 'fastmail'),
        'desc_tip' => __('Si esta opción no está habilitada, hará que Envío gratis después de y Servicios de envío gratis no sean efectivos.', 'fastmail'),
        'id' => 'fastmail_free_services',
        'type' => 'multiselect',
        'options' => array_map('esc_html', $fastmail_services),
        'desc' => __('Puedes elegir un único servicio gratuito o todos son gratuitos.', 'fastmail'),
        'custom_attributes' => array('multiple' => 'multiple'),
    );

    $settings_presis[] = array(
        'name' => __('Si hay envio gratis', 'fastmail'),
        'desc_tip' => __('Puede ocultar los otros servicios si hay un servicio gratuito, mostrar siempre el servicio gratuito más barato para la tienda o mostrar siempre todos los servicios.', 'fastmail'),
        'id' => 'fastmail_free_shipping_services_view',
        'type' => 'select',
        'options' => [
            '0' => __('Mostrar todos los servicios', 'fastmail'),
            '1' => __('Mostrar solo los servicios de envío gratis más baratos', 'fastmail'),
        ],
        'desc' => __('Qué mostrar en caso de envío gratis.', 'fastmail'),
    );

    $settings_presis[] = array(
        'name' => __('Texto de envío gratis', 'fastmail'),
        'desc_tip' => __('Pon el texto que quieras mostrar en los servicios si corresponde envío gratis, por ejemplo: (gratis)', 'fastmail'),
        'id' => 'fastmail_free_shipping_text',
        'type' => 'text',
        'desc' => __('Texto para mostrar en servicios con envío gratis', 'fastmail'),
    );

    $settings_presis[] = array(
        'name' => __('Codigo ceco', 'fastmail'),
        'desc_tip' => __('Centro de Costo', 'fastmail'),
        'id' => 'fastmail_codigo_ceco',
        'type' => 'text',
        'desc' => __('Codico Ceco provisto por la mensajeria.', 'fastmail'),
    );
}

$settings_presis[] = array('type' => 'sectionend', 'id' => 'fastmail');

return $settings_presis;
