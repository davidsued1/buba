<?php

if (!defined('ABSPATH')) {
    exit;
}

$settings_presis[] = array(
    'name' => __('Asignación de campos de facturación', 'fastmail'),
    'type' => 'title',
    'desc' => __('Si el cliente no llena el campo de envío, se tomará el mapeo de facturación.', 'fastmail'),
    'id' => 'fastmail',
);

$fields = WC()->checkout->get_checkout_fields();
$billing_fields = $fields['billing'];
if (is_null(WC()->session)) {
    WC()->session = new \WC_Session_Handler();
}
$address_fields = new \WC_Countries();

if ($address_fields !== null) {
    $billingfields = $address_fields->get_address_fields($address_fields->get_base_country(), 'billing_');
}

$billing = [];
$billing[0] = __('No mapear', 'fastmail');

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

foreach ($billingfields as $key => $fields) {
    $billing[$key] = $fields['label'] ? $fields['label'] : $key;
}

foreach ($map_attr as $key => $value) {
    $settings_presis[] = array(
        'name' => $value,
        'id' => 'fastmail_map_billing_' . $key,
        'type' => 'select',
        'options' => $billing,
    );
}

$settings_presis[] = array('type' => 'sectionend', 'id' => 'fastmail');
