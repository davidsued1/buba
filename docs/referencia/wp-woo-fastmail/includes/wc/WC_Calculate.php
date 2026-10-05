<?php
if (!defined('ABSPATH')) {
    exit;
}

use fastmail\helpers\Helper;

if (!class_exists('WC_fastmail')) {
    function fastmail_init() {
        if (!class_exists('WC_fastmail')) {
            class WC_fastmail extends WC_Shipping_Method {
                private $product_free_shipping = [];
                public $internal_rates = [];
                public $product_id = false;
                public $quantity = 1;
                public $order = false;
                public $default_instance_fastmail = false;

                private $cp;
                private $declared_value = 0;
                private $free_shipping;
                private $free_shipping_after;
                private $free_services = [];
                private $default_free_shipping;
                private $default_free_shipping_after;
                private $default_free_services = [];
                private $alias_services = [];
                private $alias_branches = [];
                private $disable_service = [];

                private $products_epresis = [];

                public function __construct($instance_id = 0) {
                    $this->default_free_shipping = get_option('fastmail_free_shipping');
                    $this->default_free_shipping_after = get_option('fastmail_free_shipping_after');
                    $this->default_free_services = get_option('fastmail_free_services');

                    $this->id = 'fastmail_shipping';
                    $this->method_title = 'Fastmail';
                    $this->method_description = 'Envios con Fastmail';
                    $this->title = 'Envío con Fastmail';
                    $this->instance_id = absint($instance_id);
                    $this->supports = array(
                        'shipping-zones',
                        'instance-settings',
                        'instance-settings-modal'
                    );
                    $this->init();
                    add_action('woocommerce_update_options_shipping_fastmail', array($this, 'process_admin_options'));
                }

                public function init() {
                    global $fastmail_sdk;

                    $classes = WC()->shipping->get_shipping_classes();
                    $this->form_fields = array();

                    // Add Free Shipping Services Options
                    $fastmail_services = $fastmail_sdk->ServiciosCliente();
                    $services = $fastmail_sdk->TodoServicios();

                    $this->loading($fastmail_services, $fastmail_sdk->SucursalesCliente(), $fastmail_sdk->TodoServicios());

                    $instance_form_fields = array(
                        'class' => array(
                            'title' => __('Si existe clase', 'fastmail'),
                            'type' => 'multiselect',
                            'desc_tip' => true,
                            'options' => []
                        ),
                        'action' => array(
                            'title' => __('Entonces', 'fastmail'),
                            'type' => 'select',
                            'default' => 'nothing',
                            'desc_tip' => __('Si selecciona Envío Gratis, deberá seleccionar el/los servicio(s) gratuito(s) en la sección Servicio Gratis', 'fastmail'),
                            'options' => array(
                                'nothing' => __('No hacer nada', 'fastmail'),
                                'disable_method' => __('Desactivar método de envío', 'fastmail'),
                                'enable_method' => __('Activar método de envío', 'fastmail'),
                                'free_shipping' => __('Envío gratis', 'fastmail')
                            )
                        ),
                        'free_shipping' => array(
                            'title' => __('Envío gratis', 'fastmail'),
                            'type' => 'checkbox'
                        ),
                        'free_shipping_after' => array(
                            'title' => __('Envío gratis después', 'fastmail'),
                            'desc_tip' => __('Toma el precio de todo el carrito, en caso de realizar una consulta sobre un producto, tome solo el producto.', 'fastmail'),
                            'type' => 'number',
                            'desc' => __('Posibilidad de envío gratuito en tienda teniendo un valor igual o superior al especificado.', 'fastmail'),
                        ),
                        'free_services' => array(
                            'title' => __('Envío gratis', 'fastmail'),
                            'desc_tip' => __('Si esta opción no está habilitada, el envío gratuito posterior y los servicios de envío gratuito quedarán ineficaces.', 'fastmail'),
                            'type' => 'multiselect',
                            'options' => [],
                            'desc' => __('Puedes elegir un único servicio gratuito o todos son gratuitos.', 'fastmail'),
                        ),
                    );

                    if (is_array($classes)) {
                        foreach ($classes as $class) {
                            $instance_form_fields['class']['options'][$class->slug] = $class->name;
                        }
                    }
                    if (is_array($services)) {
                        $instance_form_fields['free_services']['options'] = $services;
                    }

                    $this->instance_form_fields = $instance_form_fields;
                }

                public function data_products() {
                    $declared_value = 0;
                    if ($this->order) {
                        $items = Helper::get_items_from_order($this->order);
                        $this->cp = $this->order->get_shipping_postcode() ? $this->order->get_shipping_postcode() : $this->order->get_postcode();
                        $data = array(
                            'tiempo' => '',
                            'cp_destino' => $this->cp,
                            'is_urgente' => false,
                            'valor_declarado' => $this->declared_value
                        );
                    } else {
                        $items = Helper::get_items_from_cart($this->product_id, $this->quantity, $this->order);
                        $data = array(
                            'tiempo' => '',
                            'cp_destino' => $this->cp,
                            'is_urgente' => false,
                            'valor_declarado' => $this->declared_value
                        );
                    }

                    if (!is_array($items)) {
                        return false;
                    }

                    $this->products_epresis = $items;

                    foreach ($items as $key => $item) {
                        $quantity = get_post_meta($item['id'], 'fastmail_products_for_pack', true);
                        $quantity = $quantity ? $quantity : 1;

                        $declared_value += (float)$item['declared_value'];

                        $data['productos'][] = [
                            'id' => $item['id'],
                            'bultos' => $item['quantity'] * $quantity,
                            'peso' => (float)$item['weight'],
                            'dimensiones' => [
                                'alto' => (int)$item['height'],
                                'largo' => (int)$item['width'],
                                'profundidad' => (int)$item['length'],
                            ],
                        ];
                    }

                    return $data;
                }

                public function calculate_shipping($package = array()) {
                    global $wpdb, $fastmail_sdk;

                    $this->cp = WC()->customer->get_shipping_postcode();

                    if (!$this->cp) return;

                    $data = $this->data_products();

                    if ($data === false) {
                        return false;
                    }

                    $action = $this->verify_classes();

                    if ($action === 'disable_method' || !$action) {
                        return false;
                    }

                    $services = $fastmail_sdk->ObtenerPrecioServicios($data);
                    if (is_array($services)) {
                        foreach ($services as $key => $service) {
                            if ($this->disable_service($service)) continue;

                            $serv = $this->get_service($service);

                            if (!isset($shipping)) {
                                if (is_array($serv)) $shipping = $serv;
                            } else {
                                if (is_array($serv)) $shipping = array_merge($shipping, $serv);
                            }
                        }
                    }

                    if (isset($shipping)) {
                        foreach ($shipping as $key => $rate) {
                            $this->add_rate($rate);
                            $this->internal_rates[] = $rate;
                        }
                    }
                }

                public function calculate_shipping_raw() {
                    global $wpdb, $fastmail_sdk;
                    $data = $this->data_products();
                    if ($data === false) {
                        return false;
                    }
                    $services = $fastmail_sdk->ObtenerPrecioServicios($data);
                    return $services;
                }

                public function verify_classes() {
                    $products = $this->products_epresis;
                    if ($this->default_instance_fastmail) {
                        $instance = get_option("woocommerce_fastmail_shipping_{$this->default_instance_fastmail}_settings");
                        $action = $instance['action'] ?? 'nothing';
                        $class = $instance['class'] ?? 'nothing';
                        $this->free_shipping = $instance['free_shipping'] ?? false;
                        $this->free_shipping_after = $instance['free_shipping_after'] ?? false;
                        $this->free_services = $instance['free_services'] ?? false;
                    } else {
                        $action = $this->get_instance_option('action', 'nothing');
                        $class = $this->get_instance_option('class', 'nothing');
                        $this->free_shipping = $this->get_instance_option('free_shipping');
                        $this->free_shipping_after = $this->get_instance_option('free_shipping_after');
                        $this->free_services = $this->get_instance_option('free_services');
                    }
                    $classes = WC()->shipping->get_shipping_classes();

                    if (count($classes) === 0) $action = 'nothing';

                    if (!$products) {
                        return false;
                    }

                    // Free Shipping in products
                    foreach ($products as $key => $product) {
                        $product_free_shipping = json_decode(get_post_meta($product['id'], 'fastmail_free_shipping', true));
                        if (is_array($product_free_shipping) && count($product_free_shipping)) {
                            $this->declared_value += (float)$product['declared_value'];
                            $this->product_free_shipping[$product['id']] = $product_free_shipping;
                        };
                    }

                    switch ($action) {
                        case 'disable_method':
                            $condition = false;
                            foreach ($products as $item) {
                                $product = wc_get_product($item['id']);
                                if ($product->is_virtual()) {
                                    continue;
                                } elseif (in_array($product->get_shipping_class(), $class)) {
                                    $condition = true;
                                    break;
                                }
                            }
                            break;
                        case 'enable_method':
                            $action = 'nothing';
                            $condition = true;
                            foreach ($products as $item) {
                                $product = wc_get_product($item['id']);
                                if ($product->is_virtual()) {
                                    continue;
                                } elseif (in_array($product->get_shipping_class(), $class)) {
                                    $action = 'disable_method';
                                    $condition = false;
                                    break;
                                }
                            }
                            break;
                        case 'free_shipping':
                            $action = 'nothing';
                            $condition = true;
                            foreach ($products as $item) {
                                $product = wc_get_product($item['id']);
                                if ($product->is_virtual()) {
                                    continue;
                                } elseif (in_array($product->get_shipping_class(), $class)) {
                                    $this->product_free_shipping[$item['id']] = $this->free_services;
                                }
                            }
                            break;

                        default:
                            $action = 'nothing';
                            break;
                    }
                    return $action;
                }

                public function get_service($service) {
                    if (isset($service->precio->sucursales[0])) {
                        return $this->get_services_branches($service);
                    } else {
                        $id = [
                            'service_code' => $service->servicio->cod_serv,
                            'sucursal' => false,
                        ];

                        $id = base64_encode(json_encode($id));
                        $price = $this->price_shipping($service);
                        $price_real = $this->price_shipping($service, true);
                        if (!$price && $price !== 0) return false;
                        return [
                            [
                                'id' => 'fastmail_shipping:' . $id,
                                'label' => $this->get_alias_service($service) . ' ' . ($price == 0 ? get_option('fastmail_free_shipping_text') : ''),
                                'real_price' => $price_real,
                                'cost' => $price,
                                'calc_tax' => 'per_order',
                                'meta_data' => [
                                    'real_id' => 'fastmail_shipping',
                                    'real_price' => $price_real,
                                    'codigo_servicio' => $service->servicio->cod_serv,
                                    'sucursal' => false
                                ]
                            ]
                        ];
                    }
                }

                public function get_services_branches($service) {
                    $shipping = [];

                    foreach ($service->precio->sucursales as $key => $branch) {
                        $price = $this->price_shipping($service);
                        $price_real = $this->price_shipping($service, true);

                        if (!$price && $price !== 0) continue;

                        $id = [
                            'service_code' => $service->servicio->cod_serv,
                            'sucursal' => $branch,
                        ];

                        $id = base64_encode(json_encode($id));

                        $rate = array(
                            'id' => 'fastmail_shipping:' . $id,
                            'label' => $this->get_alias_branch($branch, $service->servicio->cod_serv, $service) . ' ' . ($price == 0 ? get_option('fastmail_free_shipping_text') : ''),
                            'cost' => $price,
                            'calc_tax' => 'per_order',
                            'meta_data' => [
                                'real_id' => 'fastmail_shipping',
                                'real_price' => $price_real,
                                'codigo_servicio' => $service->servicio->cod_serv,
                                'sucursal' => $branch
                            ]
                        );

                        array_push($shipping, $rate);
                    }
                    return $shipping;
                }

                public function price_shipping($service, $real = false) {
                    $total_price = $service->precio->importe_total_flete;

                    if ($this->product_id) {
                        $product = wc_get_product($this->product_id);
                        $cart_total = $product->get_price();
                    } else {
                        $cart_total = WC()->cart->cart_contents_total;
                    }

                    if ($this->free_shipping === 'yes') {
                        $free_shipping = $this->free_shipping;
                        $free_shipping_after = $this->free_shipping_after;
                        $free_services = $this->free_services;
                    } elseif ($this->default_free_shipping === 'yes') {
                        $free_shipping = $this->default_free_shipping;
                        $free_shipping_after = $this->default_free_shipping_after;
                        $free_services = $this->default_free_services;
                    }

                    if (!isset($free_services) || !is_array($free_services)) {
                        $free_services = [];
                    }

                    if (isset($free_shipping)) {
                        if ($free_shipping_after <= $cart_total && in_array($service->servicio->cod_serv, $free_services)) {
                            return !$real ? 0 : $total_price;
                        }
                    }

                    foreach ($this->product_free_shipping as $key => $product) {
                        foreach ($service->precio->productos_finales as $key2 => $price_product) {
                            if (isset($this->product_free_shipping[$price_product->id]) && in_array(base64_encode($service->servicio->cod_serv), $this->product_free_shipping[$price_product->id])) {
                                $total_price -= $price_product->valor_item;
                            }
                        }
                    }

                    return $total_price;
                }

                public function disable_service($service) {
                    return isset($this->disable_service[base64_encode($service->servicio->cod_serv)]) ? $this->disable_service[base64_encode($service->servicio->cod_serv)] : false;
                }

                public function get_alias_branch($branch, $cod_serv, $service) {
                    if (isset($this->alias_branches[base64_encode('sucursal_' . $cod_serv . '_' . $branch->id)])) {
                        return $this->alias_branches[base64_encode('sucursal_' . $cod_serv . '_' . $branch->id)];
                    } else {
                        return $service->servicio->descripcion . " " . $branch->full_address . " " . $branch->localidad;
                    }
                }

                public function get_alias_service($service) {
                    if (isset($this->alias_services[base64_encode($service->servicio->cod_serv)])) {
                        return $this->alias_services[base64_encode($service->servicio->cod_serv)];
                    } else {
                        return $service->servicio->descripcion;
                    }
                }

                public function loading($services, $branches, $all_services) {
                    foreach ($all_services as $key => $service) {
                        $disable = get_option('fastmail_disable_service_' . base64_encode($key)) == 'yes' ? true : false;
                        $this->disable_service[base64_encode($key)] = $disable;
                    }

                    foreach ($services as $key => $service) {
                        $alias = get_option('fastmail_' . base64_encode($key));
                        if ($alias) {
                            $this->alias_services[base64_encode($key)] = $alias;
                        }
                    }

                    foreach ($branches as $key => $services) {
                        foreach ($services as $key2 => $branch) {
                            $alias = get_option('fastmail_' . base64_encode($key2));
                            if ($alias) {
                                $this->alias_branches[base64_encode($key2)] = get_option('fastmail_' . base64_encode($key2));
                            }
                        }
                    }
                }

                // Add method to WC
                public function add_method($methods) {
                    $methods['fastmail_shipping'] = 'WC_fastmail';
                    return $methods;
                }

                public function get_rates() {
                    return $this->rates;
                }
            }
        }
    }

    add_action('woocommerce_shipping_init', 'fastmail_init');

    add_filter('woocommerce_shipping_methods', function ($methods) {
        $methods['fastmail_shipping'] = 'WC_fastmail';
        return $methods;
    });
}
?>
