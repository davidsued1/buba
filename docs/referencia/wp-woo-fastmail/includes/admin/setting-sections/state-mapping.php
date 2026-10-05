<?php

if (!defined('ABSPATH')) {
    exit; 
}

$settings_presis[] = array(
    'name' => __('Cambio de estado', 'fastmail'),
    'type' => 'title',
    'desc' => __('Puede sincronizar el estado de sus pedidos de WooCommerce con el estado de Fastmail.', 'fastmail'),
    'id' => 'fastmail'
);

$status_fastmail = $fastmail_sdk->Estados();
$status_fastmail = array_reduce($status_fastmail, function($result, $item) {
    $result[$item->codigo] = __($item->nombre);
    return $result;
}, []);
$status_fastmail = array_merge([
    '0' => __('No Mapear', 'fastmail')
], $status_fastmail);

$status_change = $fastmail_sdk->ActivarNotificaciones([
    'plataforma' => 'wordpress',
    'url' => admin_url('admin-ajax.php?action=fastmail_change_status_api'),
    'notificacion' => true,
    'token' => get_option('fastmail_token'),
    'sucursal' => get_option('fastmail_branch_code')
]);

foreach (wc_get_order_statuses() as $key => $service) {
    $settings_presis[] = array(
        'name' => esc_html($service),
        'id' => 'fastmail_status_change[' . esc_attr($key) . ']',
        'type' => 'select',
        'options' => array_map('esc_html', $status_fastmail)
    );
}

$settings_presis[] = array('type' => 'sectionend', 'id' => 'fastmail');

return $settings_presis;

?>
