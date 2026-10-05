<?php

namespace fastmail;

use fastmail\Sdk;

if (!defined('ABSPATH')) {
    exit; 
}

if (!class_exists('WC_Shipping_ePresis')) {
    class WC_Shipping_ePresis {
        public $post_submit = 0;

        public function __construct() {
            add_filter('woocommerce_get_sections_shipping', array($this, 'add_shipping_settings_section_tab'));
            add_filter('woocommerce_get_settings_shipping', array($this, 'add_shipping_settings_section_tab_content'), 10, 2);
        }

        public function add_shipping_settings_section_tab($section) {
            $section['fastmail'] = __('Fastmail', 'fastmail');
            return $section;
        }

        public function add_shipping_settings_section_tab_content($settings, $current_section) {
            $settings_presis = array();

            if ($current_section == 'fastmail') {
                
                
                global $fastmail_sdk;
                $fastmail_sdk->api_token = get_option('fastmail_token');
                $fastmail_sdk->cp_origen = get_option('fastmail_postal_code');
                $fastmail_sdk->codigo_sucursal = get_option('fastmail_branch_code');

                if ($_SERVER['REQUEST_METHOD'] === 'POST' && $this->post_submit === 0) {
                    $this->post_submit++;

                    if (isset($_GET['tab_active']) && $_GET['tab_active'] === 'disable-services-branches') {
                        global $wpdb;
                        $exclude_options = array_keys($_POST);
                        $placeholders = implode(',', array_fill(0, count($exclude_options), '%s'));
                        $query = $wpdb->prepare(
                            "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'fastmail_disable_service_%' AND option_name NOT IN ($placeholders)",
                            $exclude_options
                        );
                        $wpdb->query($query);
                    }
                    if (isset($_GET['tab_active']) && $_GET['tab_active'] === 'general' || !isset($_GET['tab_active'])) {
                       
                        global $wpdb;
                        $exclude_options = array_keys($_POST);
                        $placeholders = implode(',', array_fill(0, count($exclude_options), '%s'));
                        $query = $wpdb->prepare(
                            "DELETE FROM {$wpdb->options} WHERE (option_name = 'fastmail_free_shipping' OR option_name = 'fastmail_free_services') AND option_name NOT IN ($placeholders)",
                            $exclude_options
                        );
                        $wpdb->query($query);
                    }

                    wp_cache_flush();
                    
                    foreach ($_POST as $key => $value) {
                        
                        if (strpos($key, 'fastmail') === 0) {
                            if(is_array($value)){
                                update_option(sanitize_text_field($key), $value);
                            }else{
                                update_option(sanitize_text_field($key), sanitize_text_field($value));
                            }
                        }
                    }
                    

                    return $settings;
                }

                require_once 'setting-sections/settings-page.php';

                return $settings_presis;
            } else {
                return $settings;
            }
        }
    }

    $GLOBALS['wc_shipping'] = new WC_Shipping_ePresis();
}
