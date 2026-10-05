<?php

if (!defined('ABSPATH')) {
    exit; 
}

$allowed_tabs = [
    'general' => 'general.php',
    'alias-services' => 'alias-services.php',
    'cache-cleaner' => 'cache-cleaner.php',
    'alias-branches' => 'alias-branches.php',
    'disable-services-branches' => 'disable-services-branches.php',
    'state-mapping' => 'state-mapping.php',
    'field-mapping' => 'field-mapping.php',
    'billing-mapping' => 'billing-mapping.php',
    'tracking' => 'tracking.php'
];

$tab_active = isset($_GET['tab_active']) ? sanitize_text_field($_GET['tab_active']) : 'general';

if (array_key_exists($tab_active, $allowed_tabs)) {
    require_once $allowed_tabs[$tab_active];
} else {
    // Default case
    require_once 'general.php';
}
?>
