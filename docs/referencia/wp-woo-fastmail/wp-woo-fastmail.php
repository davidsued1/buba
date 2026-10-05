<?php
namespace fastmail;
/*
	Plugin Name: WooCommerce Fastmail
	Plugin URI: https://presisconsultores.com/
	Description:  Suma envios a traves de Fastmail a tu tienda de WooCommerce. Requiere WooCommerce 8.1 o superior.
	Version: 5.3
	Author: Presis Consultores
	Author URI: https://presisconsultores.com
	WC tested up to: 8.7.0
	License: GNU General Public License v3.1
	License URI: http://www.gnu.org/licenses/gpl-3.0.html
	Text Domain: fastmail
	Domain Path: /languages/
*/
if (!defined('ABSPATH')) {
	exit;
}
include_once plugin_dir_path(__FILE__) . '/includes/admin/bulk_actions/send_label.php';
include_once plugin_dir_path(__FILE__) . '/includes/admin/orders/shipping.php';
use Automattic\WooCommerce\Utilities\FeaturesUtil;
/*Load plugin textdomain*/
if (!function_exists('fastmail_load_textdomain')) {
	function fastmail_load_textdomain() {
		load_plugin_textdomain('fastmail', false, plugin_basename(dirname(__FILE__)) . '/i18n/languages');
	}
}
add_action('plugins_loaded', __NAMESPACE__ . '\\fastmail_load_textdomain');
/*Check if WooCommerce is active*/
if (!function_exists('fastmail_is_woocommerce_active')) {
	function fastmail_is_woocommerce_active() {
		include_once ABSPATH . 'wp-admin/includes/plugin.php';
		return is_plugin_active('woocommerce/woocommerce.php');
	}
}
/*Check if the plugin is network activated*/
if (!function_exists('fastmail_is_plugin_network_activated')) {
	function fastmail_is_plugin_network_activated() {
		if (!is_multisite()) {
			return false;
		}
		$active_plugins = get_site_option('active_sitewide_plugins');
		return isset($active_plugins['woocommerce/woocommerce.php']);
	}
}
/*Plugin initialization*/
if (!function_exists('fastmail_init')) {
	function fastmail_init() {
		if (fastmail_is_woocommerce_active() || fastmail_is_plugin_network_activated()) {
			add_filter('wc_order_statuses', function($wc_statuses_arr) {
				return $wc_statuses_arr;
			});
			define('DEMO_LV_PLUGIN_DIR', plugin_dir_url(__FILE__));
			include_once dirname(__FILE__) . '/includes/api/change-states.php';
			include_once dirname(__FILE__) . '/includes/api/sdk-epresis.php';
			$api_token = get_option('fastmail_token');
			$cp_origen = get_option('fastmail_postal_code');
			$codigo_sucursal = get_option('fastmail_branch_code');
			$GLOBALS['fastmail_sdk'] = new Sdk($api_token,$cp_origen,$codigo_sucursal);
			include_once dirname(__FILE__) . '/includes/admin/bulk_actions/send_label.php';
			include_once dirname(__FILE__) . '/includes/admin/bulk_actions/send_refer.php';
			include_once dirname(__FILE__) . '/includes/admin/bulk_actions/send_epresis.php';
			include_once dirname(__FILE__) . '/includes/helpers/Shipping.php';
			include_once dirname(__FILE__) . '/includes/helpers/Helper.php';
			include_once dirname(__FILE__) . '/includes/wc/WC_Calculate.php';
			include_once dirname(__FILE__) . '/includes/hooks/product/consult_delivery.php';
			include_once dirname(__FILE__) . '/includes/hooks/product/route_consult_delivery.php';
			//include_once dirname(__FILE__) . '/includes/hooks/shipping/clear_cache.php';
			include_once dirname(__FILE__) . '/includes/hooks/shipping/send_epresis.php';
			include_once dirname(__FILE__) . '/includes/hooks/shipping/save_shipping_service.php';
			include_once dirname(__FILE__) . '/includes/hooks/shipping/free_shipping_services.php';
			include_once dirname(__FILE__) . '/includes/admin/attributes/product/product_declared_value.php';
			include_once dirname(__FILE__) . '/includes/admin/attributes/product/product_free_shipping.php';
			include_once dirname(__FILE__) . '/includes/admin/attributes/product/product_quantity_for_pack.php';
			include_once dirname(__FILE__) . '/includes/admin/attributes/product/product_home_branch.php';
			include_once dirname(__FILE__) . '/includes/admin/sections.php';
			include_once dirname(__FILE__) . '/includes/shortcodes/tracking/route_tracking.php';
			include_once dirname(__FILE__) . '/includes/shortcodes/tracking/shortcode_tracking.php';
			include_once dirname(__FILE__) . '/includes/admin/orders/shipping.php';
			include_once dirname(__FILE__) . '/includes/admin/orders/shipping_route_impact.php';
			include_once dirname(__FILE__) . '/includes/admin/orders/shipping_route_label.php';
			include_once dirname(__FILE__) . '/includes/admin/orders/shipping_print_reference.php';
			include_once dirname(__FILE__) . '/includes/admin/orders_list/result_shipping.php';
			add_action('before_woocommerce_init', function () {
				if (!class_exists('FeaturesUtil')) {
					FeaturesUtil::declare_compatibility(
						'custom_order_tables',
						plugin_basename(__FILE__),
						true
					);
					FeaturesUtil::declare_compatibility(
						'custom_order_status',
						plugin_basename(__FILE__),
						true
					);
					FeaturesUtil::declare_compatibility(
						'enhanced_shipping_options',
						plugin_basename(__FILE__),
						true
					);
				} else {
					error_log('FeaturesUtil no está disponible para declarar compatibilidad.');
				}
			});
		}
	}
}

add_action('plugins_loaded', __NAMESPACE__ . '\\fastmail_init');
