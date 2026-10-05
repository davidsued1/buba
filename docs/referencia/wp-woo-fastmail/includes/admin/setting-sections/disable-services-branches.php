<?php

if (!defined('ABSPATH')) {
    exit; 
}

$status = $fastmail_sdk->VefificarConexion();

$settings_presis = [];
$settings_presis[] = array(
    'name' => __('Deshabilitar servicios y sucursales', 'fastmail'),
    'type' => 'title',
    'desc' => __('Evite que los servicios deshabilitados se muestren en el checkout o consulta de envío.', 'fastmail'),
    'id' => 'fastmail'
);

$yes_no = [
    'yes' => __('Deshabilitado', 'fastmail'),
    'no' => __('Habilitado', 'fastmail'),
];

foreach ($fastmail_sdk->TodoServicios() as $key => $service) {
    $settings_presis[] = array(
        'name' => esc_html($service),
        'id' => 'fastmail_disable_service_' . esc_attr(base64_encode($key)),
        'type' => 'select',
        'options' => $yes_no
    );
}

$settings_presis[] = array('type' => 'sectionend', 'id' => 'fastmail');

?>
