<?php
if (!defined('ABSPATH')) {
    exit;
}

use fastmail\helpers\Helper;
use fastmail\helpers\Shipping;

add_action('woocommerce_package_rates', 'package_rates_free_shipping_fastmail');

function package_rates_free_shipping_fastmail($services) {

    $action = get_option('fastmail_free_shipping_services_view');

    switch ($action) {
        case 1:
            $count = 0;
            $free_service = [];
            $service_no_fastmail = array_filter($services, function($service, $key) use (&$free_service) {
                $select = (object)$service;
                $meta_data = $select->meta_data;
                if (isset($meta_data['real_id']) && $meta_data['real_id'] === 'fastmail_shipping') {
                    if (((int)$select->cost) == 0) {
                        $free_service[$meta_data['real_price']][$key] = $service;
                    }
                } else {
                    return $service;
                }
            }, ARRAY_FILTER_USE_BOTH);

            krsort($free_service);

            if (!count($free_service)) {
                return $services;
            }

            $free_service = end($free_service);

            $result = array_merge($free_service, $service_no_fastmail);

            return $result;

        default:
            return $services;
    }
}
