<?php
if (!defined('ABSPATH')) {
    exit;
}
?>

<h2><?php echo __('Numero de orden', 'fastmail'); ?></h2>

<form method="post">
    <input type="text" name="fastmail_tracking_id" style="width:40%"><br>
    <br />
    <input type="button" value="<?php echo __('Consultar', 'fastmail'); ?>" id="consult_tracking_fastmail" class="update_button" />
    <div id="result-shipping-tracker"></div>
</form>

<script type="text/javascript">
    jQuery(function ($) {
        $('#consult_tracking_fastmail').click(function (e) {
            $('#consult_tracking_fastmail').prop('disabled', true);
            $('#result-shipping-tracker').html('<br><img style="margin-left:100px; height:30px;" src="<?php echo DEMO_LV_PLUGIN_DIR . '/images/loading.gif' ?>">');
            $.ajax({
                type: 'POST',
                url: '<?php echo $link; ?>',
                data: {
                    nonce: "<?php echo $nonce ?>",
                    tracking_id: $('[name="fastmail_tracking_id"]').val()
                },
                success: function (data) {
                    $('#consult_tracking_fastmail').prop('disabled', false);
                    $('#result-shipping-tracker').html(data);
                },
                error: function (data) {
                    $('#consult_tracking_fastmail').prop('disabled', false);
                    $('#result-shipping-tracker').html('No encontrado');
                }
            });
        });
    });
</script>
