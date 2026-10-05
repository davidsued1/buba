<?php

if (!defined('ABSPATH')) {
    exit; 
}

global $fastmail_sdk;

$status = $fastmail_sdk->VefificarConexion();

$fastmail_branch = $fastmail_sdk->SucursalesCliente();

$settings_presis = [];
$settings_presis[] = array(
    'name' => __('Alias de sucursal', 'fastmail'),
    'type' => 'title',
    'desc' => __('Muestra los nombres de las sucursales de forma personalizada.', 'fastmail'),
    'id' => 'fastmail'
);

foreach ($fastmail_branch as $key => $value) {
    $settings_presis[] = array(
        'name' => esc_html(base64_decode($key)),
        'type' => 'title',
        'desc' => '',
        'id' => 'fastmail'
    );
    foreach ($value as $key2 => $service) {
        $settings_presis[] = array(
            'name' => esc_html($service['sucursal']),
            'desc' => esc_html($service['descripcion']),
            'id' => 'fastmail_' . esc_attr(base64_encode($key2)),
            'type' => 'text'
        );
    }
    $settings_presis[] = array('type' => 'sectionend', 'id' => 'fastmail');
}

$settings_presis[] = array('type' => 'sectionend', 'id' => 'fastmail');
?>
