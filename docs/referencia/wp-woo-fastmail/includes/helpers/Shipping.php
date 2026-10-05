<?php
namespace fastmail\helpers;

use fastmail\helpers\Helper;

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('fastmail\helpers\Shipping')) {
    class Shipping
    {

        private $orders_shipping = [];
        private $orders = [];
        private $orders_ids = [];
        private static $prefix = [
            '',
            '-',
            '_',
        ];

        private $address_fields;
        private $billingfields;
        private $shippingfields;

        public function __construct()
        {
            if (is_null(WC()->session)) {
                WC()->session = new \WC_Session_Handler();
            }
            $this->address_fields = new \WC_Countries();
            $this->billingfields = $this->address_fields->get_address_fields($this->address_fields->get_base_country(), 'billing_');
            $this->shippingfields = $this->address_fields->get_address_fields($this->address_fields->get_base_country(), 'shipping_');
        }

        public function dummy()
        {
            return 'Hola Mundo';
        }

        public function add_order_id($order_id)
        {
            $this->orders_ids[] = $order_id;
        }

        public function shipment_info($order)
        {
            $shipping_methods = $order->get_shipping_methods();

            foreach ($shipping_methods as $shipping_method) {
                $method_id = $shipping_method->get_method_id();

                if ($method_id == "fastmail_shipping") {
                    $codigo_servicio = $shipping_method->get_meta('codigo_servicio');
                    $sucursal = $shipping_method->get_meta('sucursal');
                    if($codigo_servicio){
                        return (object) [
                            "sucursal" => $sucursal,
                            "codigo_servicio" => $codigo_servicio,
                            "manual" => false,
                        ];
                    }
                }
            }

            $manual = $order->get_meta('fastmail_shipping');
            if ($manual) {
                $service = json_decode(base64_decode($manual));
                if (isset($service->service_code)) {
                    return (object) [
                        "sucursal" => isset($service->sucursal)?$service->sucursal:[],
                        "codigo_servicio" => $service->service_code,
                        "manual" => true,
                    ];
                }
            }
            return (object) [
                "sucursal" => [],
                "codigo_servicio" => false,
                "manual" => false,

            ];
        }

        public function add_order($order, $service = null, $sucursal = null)
        {
            $shipment_info = $this->shipment_info($order);
            $this->orders[$order->get_id()] = $order;
            $buyer = Helper::get_customer_from_order($order, $shipment_info->sucursal);
            $items = Helper::get_items_from_order($order);

            if ($order->get_shipping_address_1()) {
                $shipping_line_1 = $order->get_shipping_address_1();
                $shipping_line_2 = $order->get_shipping_address_2();
            } else {
                $shipping_line_1 = $order->get_billing_address_1();
                $shipping_line_2 = $order->get_billing_address_2();
            }

            if ($service) {
                $servicio = $service->service_code;
                if ($sucursal) {
                    Helper::update_order_shipping($order, true, $sucursal);
                }
            } else {
                $servicio = $shipment_info->codigo_servicio;
            }

            $ceco = get_option('fastmail_codigo_ceco');

            $data = [
                'codigo_sucursal' => get_option('fastmail_branch_code'),
                'codigo_servicio' => $servicio,
                'codigo_ceco' => $ceco ? $ceco : "",
                'nro_constancia' => '',
                'lote' => '',
                'canal' => 'WooCommerce',
                'nro_precinto' => '',
                'fragil' => 0,
                'remito' => $order->get_id(),
                'guia_agente' => '',
                'fob' => 0,
                'internacional' => false,
                'valor_declarado' => 0,
                'isInversa' => false,
                'observaciones' => $buyer['customer_note'],
                'contrareembolso' => 0,
                'pago_en' => 'ORIGEN',
                'tipo_operacion' => 'ENTREGA PAQUETERIA',
                'cobro_cheque' => 0,
                'cobro_efectivo' => 0,
                'is_urgente' => false,
                'sender' => [
                    'empresa' => get_bloginfo('name'),
                    'calle' => get_option('woocommerce_store_address'),
                    'altura' => '',
                    'piso' => '',
                    'dpto' => '',
                    'celular' => '',
                    'otra_info' => '',
                    'cp' => get_option('fastmail_postal_code'),
                    'codigo_sucursal' => get_option('fastmail_branch_code'),
                    'remitente' => get_bloginfo('name'),
                    'provincia' => Helper::get_province_name(get_option('woocommerce_store_city')),
                    'localidad' => get_option('woocommerce_store_city'),
                    'email' => get_option('admin_email'),
                    'contacto' => '',
                    'other_info' => '',
                ],
                'comprador' => [
                    'codigo' => self::mapCheckout('codigo', '', $order),
                    'destinatario' => self::mapCheckout('destinatario', $buyer['addressee'], $order),
                    'calle' => self::mapCheckout('calle', $buyer['street'], $order),
                    'altura' => self::mapCheckout('altura', $buyer['number'], $order),
                    'piso' => self::mapCheckout('piso', $buyer['floor'], $order),
                    'dpto' => self::mapCheckout('dpto', $buyer['apartment'], $order),
                    'localidad' => self::mapCheckout('localidad', $buyer['locality'], $order),
                    'provincia' => self::mapCheckout('provincia', $buyer['province'], $order),
                    'tipo_doc' => self::mapCheckout('tipo_doc', '', $order),
                    'documento' => self::mapCheckout('documento', '', $order),
                    'horario' => self::mapCheckout('horario', '', $order),
                    'nro_socio' => self::mapCheckout('nro_socio', '', $order),
                    'info_adicional_1' => self::mapCheckout('info_adicional_1', $shipping_line_1, $order),
                    'info_adicional_2' => self::mapCheckout('info_adicional_2', $shipping_line_2, $order),
                    'info_adicional_3' => self::mapCheckout('info_adicional_3', '', $order),
                    'info_adicional_4' => self::mapCheckout('info_adicional_4', '', $order),
                    'info_adicional_5' => self::mapCheckout('info_adicional_5', '', $order),
                    'email' => self::mapCheckout('email', $buyer['email'], $order),
                    'celular' => self::mapCheckout('celular', $buyer['phone'], $order),
                    'cuit' => self::mapCheckout('cuit', '', $order),
                    'empresa' => self::mapCheckout('empresa', $buyer['business'], $order),
                    'contenido' => 'PAQUETERIA',
                    'cp' => $buyer['cp'],
                ],
            ];

            foreach ($items as $order_item) {
                $quantity = get_post_meta($order_item['id'], 'fastmail_products_for_pack', true);
                $quantity = $quantity ? $quantity : 1;

                $data['productos'][] = [
                    'sku' => $order_item['sku'],
                    'sku2' => $order_item['sku2'],
                    'descripcion' => strip_tags($order_item['name']),
                    'bultos' => $order_item['quantity'] * $quantity,
                    'peso' => $order_item['weight'],
                    'dimensiones' => [
                        'alto' => (float) $order_item['height'],
                        'largo' => (float) $order_item['length'],
                        'profundidad' => (float) $order_item['width'],
                    ],
					'is_bundle' => $order_item['is_bundle'] ?? false,
                ];
                $data['valor_declarado'] += (float) $order_item['declared_value'];
            }

            $this->orders_shipping['guias'][] = $data;
        }

        public static function mapCheckout($field, $default, $order)
        {
            $options = self::getOption($field);
            foreach (Shipping::$prefix as $prefix) {

                if ((isset($options->shipping) and $options->shipping) or (isset($options->billing) and $options->billing)) {
                    $shipping = $options->shipping ? get_post_meta($order->get_id(), $prefix . $options->shipping, true) : '';
                    $billing = $options->billing ? get_post_meta($order->get_id(), $prefix . $options->billing, true) : '';

                    if ($shipping != '') {
                        return $shipping;
                    } elseif ($billing != '') {
                        return $billing;
                    }
                }
            }

            return $default;
        }

        public static function getOption($field)
        {
            $map_value_shipping = get_option('fastmail_map_shipping_' . $field);
            $map_value_billing = get_option('fastmail_map_billing_' . $field);

            $options = [
                'shipping' => $map_value_shipping,
                'billing' => $map_value_billing,
            ];

            return (object) $options;
        }

        public function send()
        {
            global $fastmail_sdk;

            $response = $fastmail_sdk->EnviarMultiGuias($this->orders_shipping);

            if (!is_array($response) or !isset($response[0]->guia)) {
                return __('Error al impactar envíos', 'fastmail');
            }

            $success = 0;

            foreach ($response as $key => $shipping) {
                $order = $this->orders[$shipping->remito];
                if ($shipping->guia) {
                    $success++;
                    $order->update_meta_data('fastmail_shipping_tracking_number', $shipping->guia);
                    $order->delete_meta_data('fastmail_shipping_error');
                    $order->save();

                } else {
                    $order->update_meta_data('fastmail_shipping_error', base64_encode(json_encode($shipping)));
                    $order->save();
                }
            }
            return [
                'response' => $response,
                'success' => $success,
                'errors' => count($response) - $success,
            ];
        }

        public function print_labels($back = true)
        {
            global $fastmail_sdk;
            $label = $fastmail_sdk->ImprimirEtiquetas($this->orders_ids);

            $pdfContent = $label['archivo'];

            if (strpos($pdfContent, '%PDF') === 0) {
                header("Cache-Control: no-cache private");
                header("Content-Description: File Transfer");
                header("Content-Type: application/pdf");
                header('Content-Disposition: attachment; filename="labels.pdf"');
                header("Content-Transfer-Encoding: binary");
                header('Content-Length: ' . strlen($pdfContent));
                echo $pdfContent;
            } else {
                $label = $label['archivo'];
                if ($back) {
                    $label = str_replace(
                        '<button id="exit" class="btn btn-cerrar"><i class="fa fa-times"></i> Cerrar</button>',
                        '<button onclick="javascript:history.back()" class="btn btn-cerrar"><i class="fa fa-arrow-left"></i> Volver</button>',
                        $label
                    );
                }
                echo $label;
            }
            exit();
        }

        public function print_refers($back = true)
        {
            global $fastmail_sdk;

            $label = $fastmail_sdk->ImprimirRemitos($this->orders_ids);

            $content = $label['archivo'];

            if (strpos($content, '%PDF') === 0) {
                header("Cache-Control: no-cache private");
                header("Content-Description: File Transfer");
                header("Content-Type: application/pdf");
                header('Content-Disposition: attachment; filename="labels.pdf"');
                header("Content-Transfer-Encoding: binary");
                header('Content-Length: ' . strlen($content));
                echo $content;
            } else {
                $label = $label['archivo'];
                if ($back) {
                    $label = str_replace(
                        '<button id="exit" class="btn btn-cerrar"><i class="fa fa-times"></i> Cerrar</button>',
                        '<button onclick="javascript:history.back()" class="btn btn-cerrar"><i class="fa fa-arrow-left"></i> Volver</button>',
                        $label
                    );
                }
                echo $label;
            }
            exit();
        }
    }
}
