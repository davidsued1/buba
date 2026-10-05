<?php
if (!defined('ABSPATH')) {
    exit;
}

add_action('wp_ajax_nopriv_fastmail_consult_tracking', 'fastmail_consult_tracking');
add_action('wp_ajax_fastmail_consult_tracking', 'fastmail_consult_tracking');

function fastmail_consult_tracking() {
    global $fastmail_sdk;

    $tracking = $fastmail_sdk->SeguimientoRemito($_POST['tracking_id']);
    $table = '<table>';

    if (isset($tracking->status) && $tracking->status === "ok") {
        foreach ($tracking->guia->fechas as $key => $info) {
            $table .= "
                <tr>
                    <td>
                        {$info->fecha}
                    </td>
                    <td>
                        {$info->estado}
                    </td>
                </tr>
            ";
        }
    } else {
        $table .= "
            <tr>
                <td>
                    " . __('Información de seguimiento no encontrada.', 'fastmail') . "
                </td>
            </tr>
        ";
    }
    echo $table . '</table>';
    wp_die();
}
