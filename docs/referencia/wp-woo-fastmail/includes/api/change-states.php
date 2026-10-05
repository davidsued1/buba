<?php

if (!defined('ABSPATH')) {
    exit; 
}

add_action('wp_ajax_nopriv_fastmail_change_status_api', 'fastmail_change_status_api');
add_action('wp_ajax_fastmail_change_status_api', 'fastmail_change_status_api');

function fastmail_change_status_api() {
    header("Content-type: application/json");

    $request = json_decode(file_get_contents('php://input'));
    global $wp_query;

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        header("HTTP/1.0 404 Not Found");
        echo json_encode([
            'error' => 'Not Found',
        ]);
        exit();
    } 

    try {
        $token = get_option('fastmail_token');
        $status = get_option('fastmail_status_change');
        
        if (!isset($request->token) || $request->token !== $token) {
            throw new Exception("Token Inválido, el cliente debe actualizar la configuración de Fastmail en WordPress", 1);
        }

        if (!isset($request->orden) || !$request->orden) {
            throw new Exception("El campo orden es requerido.", 2);
        }

        $order = wc_get_order($request->orden);
        
        if (!$order) {
            throw new Exception("Orden no encontrada", 1);
        }
        
        $order->add_order_note(sprintf(__('Fastmail: %s', 'fastmail'), esc_html($request->estado)));

        $new_status = array_filter($status, function($r) use ($request) {
            return $r === $request->codigo;
        });

        foreach ($new_status as $key => $value) {
            $order->update_status($key);
            $order->add_order_note(sprintf(__('Fastmail: %s', 'fastmail'), esc_html($key)));
        }

        header("HTTP/1.0 200 OK");
        echo json_encode([
            'success' => true,
        ]);

    } catch (Throwable $th) {
        header("HTTP/1.0 500 Internal Server Error");
        echo json_encode([
            'error' => $th->getMessage(),
        ]);
    }

    exit();
}
