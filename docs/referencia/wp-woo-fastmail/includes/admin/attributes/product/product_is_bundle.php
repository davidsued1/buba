<?php
// Add custom field to product settings page
add_action('woocommerce_product_options_general_product_data', 'add_bundle_attribute');
function add_bundle_attribute() {
    woocommerce_wp_checkbox(array(
        'id' => '_is_bundle',
        'label' => __('Este item refiere a un kit', 'fastmail'),
        'description' => __('Check para indicar que este item refiere a un kit', 'fastmail')
    ));
}

// Save custom field value
add_action('woocommerce_process_product_meta', 'save_bundle_attribute');
function save_bundle_attribute($post_id): void {
    $is_bundle = isset($_POST['_is_bundle']) ? 'si' : 'no';
    update_post_meta($post_id, '_is_bundle', $is_bundle);
}