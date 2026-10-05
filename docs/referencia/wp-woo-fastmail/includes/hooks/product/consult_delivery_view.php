<?php
if (!defined('ABSPATH')) {
    exit;
}
?>

<div style="width: 100%!important; margin-top: 50px;">
    <p>
        <b>
            <?php echo __('Calcular Envio', 'fastmail'); ?>
        </b>
    </p>

    <div class="quantity" style="width: 30%">
        <label class="screen-reader-text">
            <?php echo __('Calcular Envio', 'fastmail'); ?>
        </label>
        <input type="number" name="cp" id="cp_single_shipping_calculate_fastmail" placeholder="0000" title="Qty" size="4" inputmode="numeric" style="width: 100%">
    </div>

    <button type="button" id="consult_delivery_fastmail" class="single_add_to_cart_button button alt">
        <?php echo __('Calcular', 'fastmail'); ?>
    </button>

    <div id="result-shipping-price"></div>
</div>

<script type="text/javascript">
    jQuery(function ($) {
        $('#consult_delivery_fastmail').click(function (e) {
            $('#consult_delivery_fastmail').prop('disabled', true);
            $('#result-shipping-price').html('<br><img style="margin-left:100px; height:30px;" src="<?php echo DEMO_LV_PLUGIN_DIR . '/images/loading.gif'; ?>">');
            $.ajax({
                type: 'POST',
                url: '<?php echo $link; ?>',
                data: {
                    product_id: <?php echo $product->get_id(); ?>,
                    nonce: "<?php echo $nonce; ?>",
                    quantity: $('[name="quantity"]').val(),
                    cp: $('#cp_single_shipping_calculate_fastmail').val()
                },
                success: function (data) {
                    $('#consult_delivery_fastmail').prop('disabled', false);
                    $('#result-shipping-price').html(data);
                },
                error: function (data) {
                    $('#consult_delivery_fastmail').prop('disabled', false);
                    $('#result-shipping-price').html('No encontrado');
                }
            });
        });
    });
</script>
