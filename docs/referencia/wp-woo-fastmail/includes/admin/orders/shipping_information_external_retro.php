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
            <b><?php echo esc_html(__('Servicios seleccionado', 'fastmail')); ?>:</b> <?php echo esc_html($chosen_shipping_method->method_title); ?>
        </li>
        <li class="wide">
            <b><?php echo esc_html(__('Enviar a Fastmail', 'fastmail')); ?>:</b> <span id="fastmail_impacted"><?php echo $impacted_retro ? esc_html(__('SI', 'fastmail')) : esc_html(__('NO', 'fastmail')); ?></span>
        </li>
        <li class="wide">
            <b><?php echo esc_html(__('Guía', 'fastmail')); ?>:</b> <span id="fastmail_guide"><?php echo $impacted_retro ? esc_html($impacted_retro) : esc_html(__('No disponible', 'fastmail')); ?></span>
        </li>
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
                    <center>
                        <button type="button" id="fastmail_print_label" <?php echo $impacted_retro ? '' : "disabled"; ?> class="button" name="label" value="<?php echo esc_html(__('Etiqueta', 'fastmail')); ?>"><?php echo esc_html(__('Etiqueta', 'fastmail')); ?></button>
                    </center>
                </td>
                <td>
                    <center>
                        <button type="button" id="fastmail_print_reference" <?php echo $impacted_retro ? '' : "disabled"; ?> class="button" name="reference" value="<?php echo esc_html(__('Remito', 'fastmail')); ?>"><?php echo esc_html(__('Remito', 'fastmail')); ?></button>
                    </center>
                </td>
            </tr>
        </table>
    </li>
</ul>

<script type="text/javascript">
    var guide = <?php echo $impacted_retro ? esc_js($impacted_retro) : 0; ?>;
    jQuery(function ($) {
        $('#fastmail_print_label').click(function(e) {
            e.preventDefault();
            location.href = '<?php echo esc_url(get_admin_url()); ?>?fastmail_print_label=<?php echo esc_js($impacted ? $impacted : 0); ?>';
        });

        $('#fastmail_print_reference').click(function(e) {
            e.preventDefault();
            location.href = '<?php echo esc_url(get_admin_url()); ?>?fastmail_print_reference=<?php echo esc_js($impacted ? $impacted : 0); ?>';
        });
    });
</script>
