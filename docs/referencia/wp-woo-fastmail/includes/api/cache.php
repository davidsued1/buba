<?php
namespace fastmail;
if (!defined('ABSPATH')) {
    exit;
}
class sdk_cache
{
    private $prefix = 'sdkOrders_';
    function ingresar_en_cache($id, $datos, $expira)
    {
        $cache_key = $this->prefix . $id;
        set_transient($cache_key, $datos, $expira);
    }
    public function buscar_en_cache($id)
    {
        $cache_key = $this->prefix . $id;
        $cached_data = get_transient($cache_key);
        if ($cached_data !== false) {
            return $cached_data;
        }
        return false;
    }
}
$modulo_sdk_cache = new sdk_cache();
