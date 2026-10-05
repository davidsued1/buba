<?php

if (!defined('ABSPATH')) {
    exit; 
}

global $fastmail_sdk;

$status = $fastmail_sdk->VefificarConexion();

$fastmail_services = $fastmail_sdk->ServiciosCliente();

$settings_presis = [];
$settings_presis[] = array(
    'name' => __('Alias de servicio', 'fastmail'),
    'type' => 'title',
    'desc' => __('Mostrar nombres de servicios de forma personalizada', 'fastmail'),
    'id' => 'fastmail'
);

foreach ($fastmail_services as $key => $service) {
    $settings_presis[] = array(
        'name' => esc_html($service),
        'id' => 'fastmail_' . esc_attr(base64_encode($key)),
        'type' => 'text'
    );
}

$settings_presis[] = array('type' => 'sectionend', 'id' => 'fastmail');

$fastmail_branch = $fastmail_sdk->SucursalesCliente();
?>
