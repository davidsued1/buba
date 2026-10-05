<?php if (!defined('ABSPATH')) {
    exit;
}
global $wpdb;
$wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_fastmail_services_%'");
?>
<style>
    .containerGB {
        display: flex;
        flex-direction: column;
        padding: 1rem;
    }

    .goBack {
        padding: 1rem;
        border-radius: 5px;
        border-color: rgba(250, 36, 36, 0.79);
        background-color: rgba(250, 36, 36, 0.79);
        color: white;
        width: fit-content;
        text-decoration: none;
        transition: ease-in-out 0.5s;
        margin: 0 auto 0 auto;
    }
    .goBack:hover, .goBack:active, .goBack:focus{
        background-color: rgba(23, 99, 199, 0.79);
        border-color: rgba(23, 99, 199, 0.79);
        color: white;
        -webkit-box-shadow: 0px 0px 8px 3px rgba(43, 43, 43, 0.35);
        -moz-box-shadow: 0px 0px 8px 3px rgba(43, 43, 43, 0.35);
        box-shadow: 0px 0px 8px 3px rgba(43, 43, 43, 0.35);
        transition: ease-in-out 0.5s;
    }
</style>
<div class="containerGB">
    <a class="goBack" href="?page=wc-settings&tab=shipping&section=fastmail&tab_active=general"><strong>Memoria cache eliminada con exito, volver</strong></a>
</div>