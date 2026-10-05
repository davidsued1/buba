<?php
if (!defined('ABSPATH')) {
    exit;
}

add_action('wp_ajax_nopriv_fastmail_consult_delivery', 'fastmail_consult_delivery');
add_action('wp_ajax_fastmail_consult_delivery', 'fastmail_consult_delivery');

function fastmail_consult_delivery()
{
    try {
        WC()->customer->set_shipping_postcode($_POST['cp']);
        $zones = $data = $classes_keys = array();

        // Rest of the World zone
        $zone = new \WC_Shipping_Zone(0);
        $zones[$zone->get_id()] = $zone->get_data();
        $zones[$zone->get_id()]['formatted_zone_location'] = $zone->get_formatted_location();
        $zones[$zone->get_id()]['shipping_methods'] = $zone->get_shipping_methods();

        // Merging shipping zones
        $shipping_zones = array_merge($zones, WC_Shipping_Zones::get_zones());

        // Shipping Classes
        $shipping = new \WC_Shipping();
        $shipping_classes = $shipping->get_shipping_classes();

        // The Shipping Classes for costs in "Flat rate" Shipping Method
        foreach ($shipping_classes as $shipping_class) {
            $key_class_cost = 'class_cost_' . $shipping_class->term_id;
            // The shipping classes
            $classes_keys[$shipping_class->term_id] = array(
                'term_id' => $shipping_class->term_id,
                'name' => $shipping_class->name,
                'slug' => $shipping_class->slug,
                'count' => $shipping_class->count,
                'key_cost' => $key_class_cost
            );
        }

        // For 'No class" cost
        $classes_keys[0] = array(
            'term_id' => '',
            'name' => 'No shipping class',
            'slug' => 'no_class',
            'count' => '',
            'key_cost' => 'no_class_cost'
        );

        $cut = 0;
        foreach ($shipping_zones as $shipping_zone) {
            $zone_id = $shipping_zone['id'];
            $zone_name = $zone_id == '0' ? __('Rest of the word', 'woocommerce') : $shipping_zone['zone_name'];
            $zone_locations = $shipping_zone['zone_locations']; // array
            $zone_location_name = $shipping_zone['formatted_zone_location'];

            // Set the data in an array:
            $data[$zone_id] = array(
                'zone_id' => $zone_id,
                'zone_name' => $zone_name,
                'zone_location_name' => $zone_location_name,
                'zone_locations' => $zone_locations,
                'shipping_methods' => array()
            );

            foreach ($shipping_zone['shipping_methods'] as $sm_obj) {
                $method_id = $sm_obj->id;
                $enabled = $sm_obj->is_enabled() ? true : 0;
                if ($enabled) {
                    if ($method_id == 'fastmail_shipping') {
                        if ($cut) {
                            continue;
                        }
                        $fastmail_shipping = new WC_fastmail;
                        $fastmail_shipping->product_id = $_POST['product_id'];
                        $fastmail_shipping->quantity = $_POST['quantity'];
                        $fastmail_shipping->default_instance_fastmail = $sm_obj->instance_id;
                        $fastmail_shipping->calculate_shipping();
                        $rates = $fastmail_shipping->internal_rates;

                        $key = array_search($_POST['cp'], array_column($shipping_zone['zone_locations'], 'code'));
                        if ($key) {
                            $cut = 1;
                            continue;
                        }
                    }
                }
            }
            if ($cut) {
                continue;
            }
        }

        $rates = package_rates_free_shipping_fastmail($rates);

        $table = "<table>
            <tr>
                <th>
                    " . __('Servicio', 'fastmail') . "
                </th>
                <th>
                " . __('Precio', 'fastmail') . "
                </th>
            </tr>
        ";

        if (count($rates)) {
            foreach ($rates as $key => $rate) {
                $table .= "<tr>
                        <td>
                            {$rate['label']}
                        </td>
                        <td>
                            " . get_woocommerce_currency_symbol() . " {$rate['cost']}
                        </td>
                    </tr>
                ";
            }
        } else {
            $table .= "<tr>
                    <td>
                        " . __('No existen métodos de envío para el cp seleccionado', 'fastmail') . "
                    </td>
                    <td>
                        -
                    </td>
                </tr>
            ";
        }
        echo $table . "</table>";
        wp_die();
    } catch (Exception $th) {
        echo $th->getMessage();
        wp_die();
    } catch (\Exception $th) {
        echo $th->getMessage();
        wp_die();
    } catch (Exception $th) {
        echo $th->getMessage();
        wp_die();
    } catch (\Exception $th) {
        echo $th->getMessage();
        wp_die();
    } catch (ReflectionException $th) {
        echo $th->getMessage();
        wp_die();
    } catch (\ReflectionException $th) {
        echo $th->getMessage();
        wp_die();
    }
}
