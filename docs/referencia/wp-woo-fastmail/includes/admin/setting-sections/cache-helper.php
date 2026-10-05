<?php
if (!defined('ABSPATH')) exit;
include_once dirname(__FILE__) . 'includes\helpers\cache-helper.php';
// Verificar si se presionó el botón
if (isset($_POST['accion_cache']) && $_POST['accion_cache'] === 'limpiar') {
    Cache_Helper::limpiar_transients_sdkOrders();
}
?>

<h3>Limpiar caché del plugin</h3>

<form method="post">
    <input type="hidden" name="accion_cache" value="limpiar">
    <?php submit_button('Limpiar Caché', 'primary', 'btn_limpiar_cache'); ?>
</form>