<?php if (!defined('ABSPATH')) {
    exit;
}
$status = $fastmail_sdk->VefificarConexion(); ?>
<!--css-->
<style>
    .menu {
        display: flex;
        gap: 10px;
        padding: 10px;
        border-radius: 5px;
        flex-wrap: wrap;
        justify-content: flex-start;
    }

    .menu-item {
        position: relative;
        height: 50px;
        background: #3498db;
        color: white;
        text-align: center;
        line-height: 50px;
        border-radius: 8px;
        transition: all 0.4s ease-in-out;
        cursor: pointer;
        overflow: hidden;
        text-decoration: none;
        padding: 0 1rem;
        width: auto;
    }

    .menu-item:hover,
    .menu-item:focus {
        transition: 0.4s ease-in-out;
        background: rgb(21, 90, 136);
        color: white;
    }

    .menu-item:last-child {
        background: rgb(254, 175, 6);
        color: black;
    }

    .menu-item:last-child:hover,
    .menu-item:last-child:focus {
        background: rgb(254, 175, 6);
        color: black;
        -webkit-box-shadow: 0px 0px 8px 3px rgba(43, 43, 43, 0.35);
        -moz-box-shadow: 0px 0px 8px 3px rgba(43, 43, 43, 0.35);
        box-shadow: 0px 0px 8px 3px rgba(43, 43, 43, 0.35);
    }

    .menu-item:active {
        transition: 0.4s ease-in-out;
        background: rgb(21, 90, 136);
        color: white;
        -webkit-box-shadow: 0px 0px 8px 3px rgba(82, 66, 66, 0.35);
        -moz-box-shadow: 0px 0px 8px 3px rgba(43, 43, 43, 0.35);
        box-shadow: 0px 0px 8px 3px rgba(43, 43, 43, 0.35);
    }

    .menu-item-active {
        transition: 0.4s ease-in-out;
        background: rgb(21, 90, 136);
        color: white;
        -webkit-box-shadow: 0px 0px 8px 3px rgba(43, 43, 43, 0.35);
        -moz-box-shadow: 0px 0px 8px 3px rgba(43, 43, 43, 0.35);
        box-shadow: 0px 0px 8px 3px rgba(43, 43, 43, 0.35);
    }
</style>
<!--html-->
<main>
    <h1><?php esc_html_e('Fastmail Settings', 'fastmail'); ?></h1>
    <h2 class="menu">
        <a href="?page=wc-settings&tab=shipping&section=fastmail&tab_active=general" class="menu-item <?php echo (isset($_GET['tab_active']) && $_GET['tab_active'] === 'general') ? 'menu-item-active' : ''; ?>"><?php esc_html_e('General', 'fastmail'); ?></a>
        <?php if (isset($status->cliente) && $status->cliente !== 'Error'): ?>
            <a href="?page=wc-settings&tab=shipping&section=fastmail&tab_active=alias-services" class="menu-item <?php echo (isset($_GET['tab_active']) && $_GET['tab_active'] === 'alias-services') ? 'menu-item-active' : ''; ?>"><?php esc_html_e('Alias de Servicios', 'fastmail'); ?></a>
            <a href="?page=wc-settings&tab=shipping&section=fastmail&tab_active=alias-branches" class="menu-item <?php echo (isset($_GET['tab_active']) && $_GET['tab_active'] === 'alias-branches') ? 'menu-item-active' : ''; ?>"><?php esc_html_e('Alias de Sucursales', 'fastmail'); ?></a>
            <a href="?page=wc-settings&tab=shipping&section=fastmail&tab_active=disable-services-branches" class="menu-item <?php echo (isset($_GET['tab_active']) && $_GET['tab_active'] === 'disable-services-branches') ? 'menu-item-active' : ''; ?>"><?php esc_html_e('Deshabilitar Servicios', 'fastmail'); ?></a>
            <a href="?page=wc-settings&tab=shipping&section=fastmail&tab_active=state-mapping" class="menu-item <?php echo (isset($_GET['tab_active']) && $_GET['tab_active'] === 'state-mapping') ? 'menu-item-active' : ''; ?>"><?php esc_html_e('Estados', 'fastmail'); ?></a>
            <a href="?page=wc-settings&tab=shipping&section=fastmail&tab_active=billing-mapping" class="menu-item <?php echo (isset($_GET['tab_active']) && $_GET['tab_active'] === 'billing-mapping') ? 'menu-item-active' : ''; ?>"><?php esc_html_e('Campos facturación', 'fastmail'); ?></a>
            <a href="?page=wc-settings&tab=shipping&section=fastmail&tab_active=field-mapping" class="menu-item <?php echo (isset($_GET['tab_active']) && $_GET['tab_active'] === 'field-mapping') ? 'menu-item-active' : ''; ?>"><?php esc_html_e('Campos envío', 'fastmail'); ?></a>
            <a href="?page=wc-settings&tab=shipping&section=fastmail&tab_active=tracking" class="menu-item <?php echo (isset($_GET['tab_active']) && $_GET['tab_active'] === 'tracking') ? 'menu-item-active' : ''; ?>"><?php esc_html_e('Tracking', 'fastmail'); ?></a>
            <a href="?page=wc-settings&tab=shipping&section=fastmail&tab_active=cache-helper" class="menu-item <?php echo (isset($_GET['tab_active']) && $_GET['tab_active'] === 'cache-helper') ? 'menu-item-active' : ''; ?>"><?php esc_html_e('Limpiar caché', 'fastmail'); ?></a>
        <?php endif; ?>
    </h2>
    <?php require_once 'options-switch.php'; ?>
</main>