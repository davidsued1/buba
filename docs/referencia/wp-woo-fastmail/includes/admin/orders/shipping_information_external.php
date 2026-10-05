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
            <b><?php echo esc_html(__('Servicio seleccionado', 'fastmail')); ?>:</b> <?php echo esc_html(($chosen_shipping_method && isset($chosen_shipping_method->method_title)) ? $chosen_shipping_method->method_title : __('N/A', 'fastmail')); ?>
        </li>
        <li class="wide">
            <b><?php echo esc_html(__('Enviar a Fastmail', 'fastmail')); ?>:</b> <span id="fastmail_impacted"><?php echo $impacted ? esc_html(__('SI', 'fastmail')) : esc_html(__('NO', 'fastmail')); ?></span>
        </li>
        <li class="wide">
            <b><?php echo esc_html(__('Guía', 'fastmail')); ?>:</b> <span id="fastmail_guide"><?php echo $impacted ? esc_html($impacted) : esc_html(__('No disponible', 'fastmail')); ?></span>
        </li>
        <li class="wide">
            <b><?php echo esc_html(__('Remito', 'fastmail')); ?>:</b> <?php echo esc_html($post_id); ?>
        </li>
        <li class="wide">
            <b><?php echo esc_html(__('Seleccionar servicio de Fastmail', 'fastmail')); ?>:</b>
            <select name="fastmail_service" id="fastmail_service" class="fastmail_service" <?php echo $impacted ? "disabled" : ""; ?>>
                <option value=""><?php echo esc_html(__('Servicio seleccionado', 'fastmail')); ?></option>
                <?php foreach ($prices as $service): ?>
                    <?php if (count($service->precio->sucursales)): ?>
                        <optgroup label="<?php echo esc_html($service->servicio->descripcion); ?>">
                            <?php foreach ($service->precio->sucursales as $branch): ?>
                                <?php
                                    $id = [
                                        'service_code' => $service->servicio->cod_serv,
                                        'sucursal' => $branch,
                                    ];
                                    $id = base64_encode(json_encode($id));
                                ?>
                                <option value="<?php echo esc_attr($id); ?>" <?php echo $service_impacted === $id ? "selected" : ""; ?>><?php echo esc_html($branch->full_address) . ' ' . esc_html(get_woocommerce_currency_symbol() . $service->precio->importe_total_flete); ?></option>
                            <?php endforeach;?>
                        </optgroup>
                    <?php else: ?>
                        <?php
                            $id = [
                                'service_code' => $service->servicio->cod_serv,
                                'sucursal' => false,
                            ];
                            $id = base64_encode(json_encode($id));
                        ?>
                        <option value="<?php echo esc_attr($id); ?>" <?php echo $service_impacted === $id ? "selected" : ""; ?>><?php echo esc_html($service->servicio->descripcion) . ' ' . esc_html(get_woocommerce_currency_symbol() . $service->precio->importe_total_flete); ?></option>
                    <?php endif;?>
                <?php endforeach;?>
            </select>
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
                    <button type="button" id="fastmail_print_label" <?php echo $impacted ? '' : "disabled"; ?> class="button save_order" name="label" value="<?php echo esc_html(__('Etiqueta', 'fastmail')); ?>"><?php echo esc_html(__('Etiqueta', 'fastmail')); ?></button>
                </td>
                <td>
                    <button type="button" id="fastmail_print_reference" <?php echo $impacted ? '' : "disabled"; ?> class="button save_order" name="reference" value="<?php echo esc_html(__('Remito', 'fastmail')); ?>"><?php echo esc_html(__('Remito', 'fastmail')); ?></button>
                </td>
                <td>
                    <button type="button" id="impact_fastmail" <?php echo !$impacted ? '' : "disabled"; ?> class="button save_order button-primary" name="impact" value="<?php echo esc_html(__('Impacto', 'fastmail')); ?>"><?php echo esc_html(__('Impacto', 'fastmail')); ?></button>
                </td>
            </tr>
        </table>
    </li>
</ul>
<script type="text/javascript">
    var guide = <?php echo esc_js($impacted ? $impacted : 0); ?>;
    jQuery(function ($) {
        $('#impact_fastmail').click(function (e) {
            $('#impact_fastmail').prop('disabled', true);

            if (!$('#fastmail_service').val()) {
                alert("<?php echo esc_js(__('Tienes que elegir un servicio para impactar el pedido en Fastmail', 'fastmail')); ?>");
                $('#impact_fastmail').prop('disabled', false);
                return;
            } else {
                $.ajax({
                    type: 'POST',
                    url: '<?php echo esc_url($link_impact); ?>',
                    data: {
                        nonce: "<?php echo esc_js($nonce_impact); ?>",
                        order: <?php echo esc_js($post_id); ?>,
                        fastmail_service: $('#fastmail_service').val()
                    },
                    success: function (data) {
                        if (data.data.guia) {
                            $('#fastmail_service').prop('disabled', true);
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
            }
        });

        $('#fastmail_print_label').click(function () {
            location.href = '<?php echo esc_url(get_admin_url()); ?>?fastmail_print_label=<?php echo esc_js($impacted ? $impacted : 0); ?>';
        });

        $('#fastmail_print_reference').click(function () {
            location.href = '<?php echo esc_url(get_admin_url()); ?>?fastmail_print_reference=<?php echo esc_js($impacted ? $impacted : 0); ?>';
        });
    });
</script>