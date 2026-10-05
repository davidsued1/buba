<?php if (!defined('ABSPATH')) {
    exit;
}
?>

<style>
    #fastmail_carrier_box .fastmail_content_box {
        padding: 0 12px 0px!important;
    }
    #fastmail_carrier_box .inside {
        padding: 0px 0px 0px!important;
    }
    #fastmail_carrier_box .fastmail_service,
    #fastmail_carrier_box .fastmail_table_orders {
        width: 100%!important;
        clear: both;
    }
    #fastmail_carrier_box .fastmail_content_box .order_actions li:last-child {
        border-bottom: 0px;
    }
</style>
<div class="fastmail_content_box">
    <ul class="order_actions submitbox fastmail_list">
        <li class="wide">
            <b><?php echo esc_html(__('Servicio Seleccionado', 'fastmail')); ?>:</b> <?php echo esc_html($chosen_shipping_method->method_title); ?>
        </li>
        <li class="wide">
            <b><?php echo esc_html(__('Enviar a Fastmail', 'fastmail')); ?>:</b> <span id="fastmail_impacted"><?php echo $impacted ? esc_html(__('Si', 'fastmail')) : esc_html(__('NO', 'fastmail')); ?></span>
        </li>
        <li class="wide">
            <b><?php echo esc_html(__('Guía', 'fastmail')); ?>:</b> <span id="fastmail_guide"><?php echo $impacted ? esc_html($impacted) : esc_html(__('No disponible', 'fastmail')); ?></span>
        </li>
        <!--revisar boton. validar si no hay imagen configurada-->
        <li class="wide">
            <b><?php echo esc_html(__('Remito', 'fastmail')); ?>:</b> <?php echo esc_html($post_id); ?>
        </li>
    </ul>
    <center id="result_fastmail"></center>
</div>
<ul class="order_actions submitbox">
    <li class="wide" id="actions"></li>
    <li class="wide">
        <table class="fastmail_table_orders">
            <tr>
                <td>
                    <button type="button" id="fastmail_print_label" <?php echo $impacted ? '' : "disabled"; ?> class="button save_order" name="label" value="<?php echo esc_attr(__('Etiqueta', 'fastmail')); ?>"><?php echo esc_html(__('Etiqueta', 'fastmail')); ?></button>
                </td>
                <td>
                    <button type="button" id="fastmail_print_reference" <?php echo $impacted ? '' : "disabled"; ?> class="button save_order" name="reference" value="<?php echo esc_attr(__('Remito', 'fastmail')); ?>"><?php echo esc_html(__('Remito', 'fastmail')); ?></button>
                </td>
                <td>
                    <button type="button" id="impact_fastmail" <?php echo !$impacted ? '' : "disabled"; ?> class="button save_order button-primary" name="impact" value="<?php echo esc_attr(__('Impacto', 'fastmail')); ?>"><?php echo esc_html(__('Impacto', 'fastmail')); ?></button>
                </td>
            </tr>
        </table>
    </li>
</ul>
<script type="text/javascript">
    var guide = <?php echo esc_js($impacted ? $impacted : 0); ?>;
    jQuery(function ($) {
        $('#impact_fastmail').click(function () {
            $('#impact_fastmail').prop('disabled', true);

            $.ajax({
                type: 'POST',
                url: '<?php echo esc_url($link_impact); ?>',
                data: {
                    nonce: "<?php echo esc_js($nonce_impact); ?>",
                    order: <?php echo esc_js($post_id); ?>
                },
                success: function (data) {
                    if (data.data.guia) {
                        $('#fastmail_print_label').prop('disabled', false);
                        $('#fastmail_print_reference').prop('disabled', false);
                        $('#fastmail_impacted').html("<?php echo esc_html(__('SI', 'fastmail')); ?>");
                        $('#fastmail_guide').html(data.data.guia);
                    } else {
                        $('#impact_fastmail').prop('disabled', false);
                    }
                    $('#result_fastmail').html(data.data.message);
                },
                error: function () {
                    $('#impact_fastmail').prop('disabled', false);
                }
            });
        });

        $('#fastmail_print_label').click(function () {
            location.href = '<?php echo esc_url(get_admin_url()); ?>?fastmail_print_label=<?php echo esc_js($impacted ? $impacted : 0); ?>';
        });

        $('#fastmail_print_reference').click(function () {
            location.href = '<?php echo esc_url(get_admin_url()); ?>?fastmail_print_reference=<?php echo esc_js($impacted ? $impacted : 0); ?>';
        });
    });
</script>
