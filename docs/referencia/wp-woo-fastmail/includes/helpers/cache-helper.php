<?php
if (!defined('ABSPATH')) exit;
class Cache_Helper {
    public static function limpiar_transients_sdkOrders() {
        global $wpdb;
        $sql = "DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_sdkOrders_%' OR option_name LIKE '_transient_timeout_sdkOrders_%'";
        $wpdb->query($sql);
        return true;
    }
}