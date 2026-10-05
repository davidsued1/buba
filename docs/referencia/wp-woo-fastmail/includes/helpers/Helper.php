<?php

namespace fastmail\helpers;

use fastmail\helpers\Shipping;

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('fastmail\helpers\Helper')) {

    class Helper
    {
        private $orders_shipping = [];

        public function __construct()
        {
        }

        public static function update_order_shipping($order, $shipping, $sucursal = null)
        {
            if (isset($shipping)) {
                if ($shipping && !$sucursal) {
                    $shipping_info = $shipping->shipment_info($order);
                    if (!empty($shipping_info->sucursal)) {
                        $sucursal = $shipping_info->sucursal;
                    }
                }

                if ($sucursal !== null) {
                    $order->update_meta_data(Shipping::getOption('altura')->shipping, $sucursal->altura ?? '');
                    $order->update_meta_data(Shipping::getOption('calle')->shipping, $sucursal->calle ?? '');
                    $order->update_meta_data(Shipping::getOption('piso')->shipping, $sucursal->piso ?? '');
                    $order->update_meta_data(Shipping::getOption('dpto')->shipping, $sucursal->dpto ?? '');
                    $order->set_shipping_address_1(($sucursal->calle ?? '') . ' ' . ($sucursal->altura ?? ''));
                    $order->set_shipping_address_2(($sucursal->piso ?? '') . ' ' . ($sucursal->dpto ?? ''));
                    $order->set_shipping_city($sucursal->localidad ?? '');
                    $order->set_shipping_state($sucursal->provincia ?? '');
                    $order->set_shipping_postcode($sucursal->cp ?? '');
                }

            }

            $order->save();
        }

        public static function update_order_shipping_base64($order, $data)
        {
            $order->update_meta_data('fastmail_shipping', $data);

            $data = json_decode(base64_decode($data));

            if (isset($data->sucursal) && $data->sucursal) {
                if (Shipping::getOption('altura')->shipping) {
                    $order->update_meta_data(Shipping::getOption('altura')->shipping, $data->sucursal->altura);
                }

                if (Shipping::getOption('calle')->shipping) {
                    $order->update_meta_data(Shipping::getOption('calle')->shipping, $data->sucursal->calle);
                }

                if (Shipping::getOption('piso')->shipping) {
                    $order->update_meta_data(Shipping::getOption('piso')->shipping, $data->sucursal->piso);
                }

                if (Shipping::getOption('dpto')->shipping) {
                    $order->update_meta_data(Shipping::getOption('dpto')->shipping, $data->sucursal->dpto);
                }

                $order->set_shipping_address_1($data->sucursal->calle . ' ' . $data->sucursal->altura);
                $order->set_shipping_city($data->sucursal->localidad);
                $order->set_shipping_postcode($data->sucursal->cp);
            }

            $order->save();
        }

        public static function get_items_from_cart($product_id = false, $quantity = 1)
        {
            $products = [];
            if ($product_id) {
                $product = wc_get_product($product_id);

                $product_id = $product->get_id();
                if ($product->is_virtual()) {
                    return [];
                }
                $new_product = self::get_product_dimensions($product_id);

                if (!$new_product) {
                    return false;
                }

                $declared_value = get_post_meta($product_id, 'fastmail_declared_value', true);

                $products[0] = $new_product;
                $products[0]['name'] = $product->get_data()['name'];
                $products[0]['quantity'] = $quantity;
                $products[0]['declared_value'] = $declared_value;
            } else {
                $items = WC()->cart->get_cart();
                foreach ($items as $i => $item) {
                    $product_id = $item['data']->get_id();
                    if ($item['data']->is_virtual()) {
                        continue;
                    }

                    $new_product = self::get_product_dimensions($product_id);

                    if (!$new_product) {
                        return false;
                    }

                    $declared_value = get_post_meta($product_id, 'fastmail_declared_value', true);

                    $products[$i] = $new_product;
                    $products[$i]['name'] = $item['data']->get_data()['name'];
                    $products[$i]['quantity'] = $item['quantity'];
                    $products[$i]['declared_value'] = $declared_value;
                }
            }

            return $products;
        }

        public static function get_product_dimensions($product_id)
        {
            $product = wc_get_product($product_id);

            if (!$product) {
                return false;
            }

            if (empty($product->get_height()) || empty($product->get_length()) || empty($product->get_width()) || !$product->has_weight()) {
                return false;
            }

            $dimension_unit = 'cm';
            $weight_unit = 'kg';

            return [
                'height' => round(($product->get_height() ? wc_get_dimension($product->get_height(), $dimension_unit) : '0'), 2),
                'width' => round(($product->get_width() ? wc_get_dimension($product->get_width(), $dimension_unit) : '0'), 2),
                'length' => round(($product->get_length() ? wc_get_dimension($product->get_length(), $dimension_unit) : '0'), 2),
                'weight' => round(($product->has_weight() ? wc_get_weight($product->get_weight(), $weight_unit) : '0'), 2),
                'price' => $product->get_price(),
                'id' => $product_id,
            ];
        }

        public static function get_private_order_notes($order_id, $note = false, $manual = false)
        {
            global $wpdb;

            $table_perfixed = $wpdb->prefix . 'comments';

            $sql = "SELECT * FROM $table_perfixed WHERE  `comment_post_ID` = $order_id AND  `comment_type` LIKE  'order_note'";

            if ($note) {
                $sql .= " AND `comment_content` LIKE '$note' ";
            }

            if ($manual) {
                $sql .= "  AND `comment_author` != 'WooCommerce'";
            } else {
                $sql .= "  AND `comment_author` = 'WooCommerce' ";
            }

            $results = $wpdb->get_results($sql);

            foreach ($results as $note) {
                $order_note[] = [
                    'note_date' => $note->comment_date,
                    'note_content' => $note->comment_content,
                    'user_id' => $note->user_id,
                    'all' => $note,
                ];
            }

            return isset($order_note) ? $order_note : null;
        }

        public static function get_customer_from_order($order, $sucursal = false)
        {
            if (!$order) {
                return false;
            }

            $address = self::get_address($order, $sucursal);
            return [
                'addressee' => $order->has_shipping_address() ? $order->get_formatted_shipping_full_name() : $order->get_formatted_billing_full_name(),
                'street' => $address['street'],
                'number' => $address['number'],
                'floor' => $address['floor'],
                'apartment' => $address['apartment'],
                'customer_note' => $order->get_customer_note(),
                'cp' => self::get_postal_code($order),
                'email' => $order->get_billing_email(),
                'phone' => $order->get_billing_phone(),
                'locality' => self::get_locality($order),
                'province' => self::get_province($order),
                'business' => $sucursal ? $sucursal->razonSocial : '',
            ];
        }

        public static function get_address($order, $sucursal = false)
        {
            if (!$order) {
                return false;
            }

            if ($sucursal) {
                return [
                    'street' => $sucursal->calle,
                    'number' => $sucursal->altura,
                    'floor' => $sucursal->piso,
                    'apartment' => $sucursal->dpto,
                ];
            }

            if ($order->get_shipping_address_1()) {
                $shipping_line_1 = $order->get_shipping_address_1();
                $shipping_line_2 = $order->get_shipping_address_2();
            } else {
                $shipping_line_1 = $order->get_billing_address_1();
                $shipping_line_2 = $order->get_billing_address_2();
            }

            $street_name = $street_number = $floor = $apartment = "";
            if (!empty($shipping_line_2)) {
                // There is something in the second line. Let's find out what
                $fl_apt_array = self::get_floor_and_apt($shipping_line_2);
                $floor = $fl_apt_array[0];
                $apartment = $fl_apt_array[1];
            }

            // Now let's work on the first line
            preg_match('/(^\d*[\D]*)(\d+)(.*)/i', $shipping_line_1, $res);
            $line1 = $res;

            if ((isset($line1[1]) && !empty($line1[1]) && $line1[1] !== " ") && !empty($line1)) {
                // Everything's fine. Go ahead
                if (empty($line1[3]) || $line1[3] === " ") {
                    // The user just wrote the street name and number, as he should
                    $street_name = trim($line1[1]);
                    $street_number = trim($line1[2]);
                    unset($line1[3]);
                } else {
                    // There is something extra in the first line. We'll save it in case it's important
                    $street_name = trim($line1[1]);
                    $street_number = trim($line1[2]);
                    $shipping_line_2 = trim($line1[3]);

                    if (empty($floor) && empty($apartment)) {
                        // If we don't have either the floor or the apartment, they should be in our new $shipping_line_2
                        $fl_apt_array = self::get_floor_and_apt($shipping_line_2);
                        $floor = $fl_apt_array[0];
                        $apartment = $fl_apt_array[1];
                    } elseif (empty($apartment)) {
                        // We've already have the floor. We just need the apartment
                        $apartment = trim($line1[3]);
                    } else {
                        // We've got the apartment, so let's just save the floor
                        $floor = trim($line1[3]);
                    }
                }
            } else {
                // The user didn't write the street number. Maybe it's in the second line
                // Given the fact that there is no street number in the first line, we'll assume it's just the street name
                $street_name = $shipping_line_1;

                if (!empty($floor) && !empty($apartment)) {
                    // We are in a pickle. It's a risky move, but we'll move everything one step up
                    $street_number = $floor;
                    $floor = $apartment;
                    $apartment = "";
                } elseif (!empty($floor) && empty($apartment)) {
                    // It seems the user wrote only the street number in the second line. Let's move it up
                    $street_number = $floor;
                    $floor = "";
                } elseif (empty($floor) && !empty($apartment)) {
                    // I don't think there's a chance of this even happening, but let's write it to be safe
                    $street_number = $apartment;
                    $apartment = "";
                }
            }
            return [
                'street' => $street_name,
                'number' => $street_number,
                'floor' => $floor,
                'apartment' => $apartment,
            ];
        }

        public static function get_floor_and_apt($fl_apt)
        {
            $apartment = '';
            // Exit()
            // First we'll assume the user did things right. Something like "piso 24, depto. 5h"
            preg_match('/(piso|p|p.) ?(\w+),? ?(departamento|depto|dept|dpto|dpt|dpt.º|depto.|dept.|dpto.|dpt.|apartamento|apto|apt|apto.|apt.) ?(\w+)/i', $fl_apt, $res);
            $line2 = $res;

            if (!empty($line2)) {
                // Everything was written great. Now lets grab what matters
                $floor = trim($line2[2]);
                $apartment = trim($line2[4]);
            } else {
                // Maybe the user wrote something like "depto. 5, piso 24". Let's try that
                preg_match('/(departamento|depto|dept|dpto|dpt|dpt.º|depto.|dept.|dpto.|dpt.|apartamento|apto|apt|apto.|apt.) ?(\w+),? ?(piso|p|p.) ?(\w+)/i', $fl_apt, $res);
                $line2 = $res;
            }

            if (!empty($line2) && empty($apartment) && empty($floor)) {
                // Apparently, that was the case. Guess some people just like to make things difficult
                $floor = trim($line2[4]);
                $apartment = trim($line2[2]);
            } else {
                // Something is wrong. Let's be more specific. First we'll try with only the floor
                preg_match('/^(piso|p|p.) ?(\w+)$/i', $fl_apt, $res);
                $line2 = $res;
            }

            if (!empty($line2) && empty($floor)) {
                // Now we've got it! The user just wrote the floor number. Now lets grab what matters
                $floor = trim($line2[2]);
            } else {
                // Still no. Now we'll try with the apartment
                preg_match('/^(departamento|depto|dept|dpto|dpt|dpt.º|depto.|dept.|dpto.|dpt.|apartamento|apto|apt|apto.|apt.) ?(\w+)$/i', $fl_apt, $res);
                $line2 = $res;
            }

            if (!empty($line2) && empty($apartment) && empty($floor)) {
                // Success! The user just wrote the apartment information. No clue why, but who am I to judge
                $apartment = trim($line2[2]);
            } else {
                // Ok, weird. Now we'll try a more generic approach just in case the user misspelled something
                preg_match('/(\d+),? [a-zA-Z.,!*]* ?([a-zA-Z0-9 ]+)/i', $fl_apt, $res);
                $line2 = $res;
            }

            if (!empty($line2) && empty($floor) && empty($apartment)) {
                // Finally! The user just misspelled something. It happens to the best of us
                $floor = trim($line2[1]);
                $apartment = trim($line2[2]);
            } else {
                // Last try! This one is in case the user wrote the floor and apartment together ("12C")
                preg_match('/(\d+)(\D*)/i', $fl_apt, $res);
                $line2 = $res;
            }

            if (!empty($line2) && empty($floor) && empty($apartment)) {
                // Ok, we've got it. I was starting to panic
                $floor = trim($line2[1]);
                $apartment = trim($line2[2]);
            } elseif (empty($floor) && empty($apartment)) {
                // I give up. I can't make sense of it. We'll save it in case it's something useful
                $floor = $fl_apt;
            }

            return [$floor, $apartment];
        }

        // This method works for carts and orders
        public static function get_province($customer)
        {
            $province = false;
            if (!($province = $customer->get_shipping_state())) {
                $province = $customer->get_billing_state();
            }

            return self::get_province_name($province);
        }

        // This method works for carts and orders
        public static function get_locality($customer)
        {
            $locality = false;
            if (!($locality = $customer->get_shipping_city())) {
                $locality = $customer->get_billing_city();
            }

            return $locality;
        }

        // This method works for carts and orders
        public static function get_postal_code($customer)
        {
            $postal_code = false;
            if (!($postal_code = $customer->get_shipping_postcode())) {
                $postal_code = $customer->get_billing_postcode();
            }

            return $postal_code;
        }

        // This function works for carts and orders
        public static function get_customer_name($customer)
        {
            $name = false;
            if ($customer->get_shipping_first_name()) {
                $name = $customer->get_shipping_first_name() . ' ' . $customer->get_shipping_first_name();
            } else {
                $name = $customer->get_billing_first_name() . ' ' . $customer->get_billing_first_name();
            }
            return $name;
        }

        public static function get_province_name($province_id = '')
        {
            switch ($province_id) {
                case 'C':
                    $zone = 'CIUDAD AUTONOMA DE BUENOS AIRES';
                    break;
                case 'B':
                default:
                    $zone = 'BUENOS AIRES';
                    break;
                case 'K':
                    $zone = 'CATAMARCA';
                    break;
                case 'H':
                    $zone = 'CHACO';
                    break;
                case 'U':
                    $zone = 'CHUBUT';
                    break;
                case 'X':
                    $zone = 'CORDOBA';
                    break;
                case 'W':
                    $zone = 'CORRIENTES';
                    break;
                case 'E':
                    $zone = 'ENTRE RIOS';
                    break;
                case 'P':
                    $zone = 'FORMOSA';
                    break;
                case 'Y':
                    $zone = 'JUJUY';
                    break;
                case 'L':
                    $zone = 'LA PAMPA';
                    break;
                case 'F':
                    $zone = 'LA RIOJA';
                    break;
                case 'M':
                    $zone = 'MENDOZA';
                    break;
                case 'N':
                    $zone = 'MISIONES';
                    break;
                case 'Q':
                    $zone = 'NEUQUEN';
                    break;
                case 'R':
                    $zone = 'RIO NEGRO';
                    break;
                case 'A':
                    $zone = 'SALTA';
                    break;
                case 'J':
                    $zone = 'SAN JUAN';
                    break;
                case 'D':
                    $zone = 'SAN LUIS';
                    break;
                case 'Z':
                    $zone = 'SANTA CRUZ';
                    break;
                case 'S':
                    $zone = 'SANTA FE';
                    break;
                case 'G':
                    $zone = 'SANTIAGO DEL ESTERO';
                    break;
                case 'V':
                    $zone = 'TIERRA DEL FUEGO';
                    break;
                case 'T':
                    $zone = 'TUCUMAN';
                    break;
            }
            return $zone;
        }

        public static function get_items_from_order($order)
        {
            $products = [];
            $items = $order->get_items();
            foreach ($items as $i => $item) {
                $product_id = $item->get_variation_id();
                if (!$product_id) {
                    $product_id = $item->get_product_id();
                }
                $sb_ids = get_post_meta($product_id, 'woosb_ids', true);
                $is_bundle = false;
                if ($sb_ids != "") {
                    $is_bundle = count(get_post_meta($product_id, 'woosb_ids', true)) > 1 ? true : false;
                }

                if (!$is_bundle) {

                    $product = wc_get_product($product_id);

                    $new_product = self::get_product_dimensions($product_id);

                    $declared_value = (float) get_post_meta($product_id, 'fastmail_declared_value', true);

                    $products[$i] = $new_product;
                    $products[$i]['name'] = $item->get_data()['name'];
                    $products[$i]['quantity'] = $item['quantity'];
                    $products[$i]['product_id'] = $product_id;
                    $products[$i]['declared_value'] = $declared_value;
                    $products[$i]['sku'] = $product->get_sku();
                    $products[$i]['sku2'] = get_post_meta($product_id, 'fastmail_product_home_branch', true);
                }

            }
            return $products;
        }
    }

}
