<?php

if (!defined('ABSPATH')) {
    exit;
}

$settings_presis[] = array(
    'name' => __('Asignación de campos de envío', 'fastmail'),
    'type' => 'title',
    'desc' => __('Puede asignar los atributos personalizados en su pago para enviar a Fastmail.', 'fastmail'),
    'id' => 'fastmail',
);

$address_fields = new \WC_Countries();
$shippingfields = $address_fields->get_address_fields($address_fields->get_base_country(), 'shipping_');

$shipping = [];
$shipping[0] = __('No mapear', 'fastmail');

foreach ($shippingfields as $key => $fields) {
    $shipping[$key] = $fields['label'] ? $fields['label'] : $key;
}

$map_attr = [
    'calle' => __('Calle', 'fastmail'),
    'altura' => __('Número (Solo admite números)', 'fastmail'),
    'piso' => __('Piso', 'fastmail'),
    'dpto' => __('Departamento', 'fastmail'),
    'tipo_doc' => __('Tipo Documento', 'fastmail'),
    'documento' => __('Num. Documento', 'fastmail'),
    'horario' => __('Horario', 'fastmail'),
    'cuit' => __('Cuit', 'fastmail'),
    'info_adicional_1' => __('Informacion adicional 1', 'fastmail'),
    'info_adicional_2' => __('Informacion adicional 2', 'fastmail'),
    'info_adicional_3' => __('Informacion adicional 3', 'fastmail'),
    'info_adicional_4' => __('Informacion adicional 4', 'fastmail'),
    'info_adicional_5' => __('Informacion adicional 5', 'fastmail'),
    'nro_socio' => __('Número de socio', 'fastmail'),
    'codigo' => __('Código', 'fastmail'),
];

foreach ($map_attr as $key => $value) {
    $settings_presis[] = array(
        'name' => $value,
        'id' => 'fastmail_map_shipping_' . esc_attr($key),
        'type' => 'select',
        'options' => array_map('esc_html', $shipping),
    );
}

$settings_presis[] = array('type' => 'sectionend', 'id' => 'fastmail');
