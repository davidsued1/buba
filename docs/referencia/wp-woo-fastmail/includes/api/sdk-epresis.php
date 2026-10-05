<?php
namespace fastmail;

if (! defined('ABSPATH')) {
    exit;
}
class Sdk
{
    /**
     * @var string $root_endpoind is the main URL to access the e-Presis API's.
     * @var string $services_endpoind api to get services.
     * @var string $services_clients_endpoind api to get services by clients.
     * @var string $prices_endpoind api to get prices for services.
     * @var string $package_guide_endpoind api to impact orders.
     * @var string $package_documentation_endpoind api to get shipping document.
     * @var string $package_label_endpoind api to get shipping label.
     * @var string $tracking_endpoind api to consult tracking.
     * @var string $provinces_endpoind api to consult provinces.
     * @var string $localities_endpoind api to consult locations.
     * @var string $dummy_endpoind api to verify connection to ePresis.
     */

    private $root_endpoint                  = 'https://epresislv.fastmail.com.ar/';
    private $services_endpoind              = 'api/v1/public/servicios.json';
    private $services_clients_endpoind      = 'api/v2/servicios-cliente.json';
    private $services_prices_endpoind       = 'api/v2/precio-servicio.json';
    private $prices_endpoind                = 'api/v2/cotizador.json';
    private $package_guide_endpoind         = 'api/v2/guias.json';
    private $package_documentation_endpoind = 'api/v1/public/print_guias.json';
    private $package_label_endpoind         = 'api/v1/public/print_etiquetas.json';
    private $tracking_endpoind              = 'api/v2/seguimiento.json';
    private $provinces_endpoind             = 'api/v2/provincias.json';
    private $localities_endpoind            = 'api/v2/localidades.json';
    private $dummy_endpoind                 = 'api/v2/dummy-test.json';
    private $multi_guias_endpoind           = 'api/v2/multi-guias.json';
    private $estados_endpoind               = 'api/v2/estados.json';
    private $cambio_estados_endpoind        = 'api/v2/integracion.json';
    private $version_endpoind               = 'api/v2/version_cms.json';
    private $tipo_etiqueta                  = 'HTML';
    private $tipo_remito                    = 'HTML';
    private $cache_key                      = 'fastmail_';
    public $cache;
    public $api_token;
    public $cp_origen;
    public $codigo_sucursal;
    public $services = null;

    public function __construct($api_token, $cp_origen, $codigo_sucursal)
    {
        $this->api_token       = $api_token;
        $this->cp_origen       = $cp_origen;
        $this->codigo_sucursal = $codigo_sucursal;
    }

    public function Api($url, $body, $tipo = 'POST',  $raw = false)
    {
        $domain  = parse_url(site_url(), PHP_URL_HOST);
        $headers = ['Content-Type: application/json'];
        if ($domain) {
            $headers[] = 'aws-x-prs-wp: presis-' . $domain;
        }
        $body    = $this->PrepararRequest($body);
        $curl    = curl_init();
        $options = [
            CURLOPT_URL            => $this->root_endpoint . $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_ENCODING       => '',
            CURLOPT_MAXREDIRS      => 10,
            CURLOPT_TIMEOUT        => 0,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTP_VERSION   => CURL_HTTP_VERSION_1_1,
            CURLOPT_CUSTOMREQUEST  => $tipo,
            CURLOPT_HTTPHEADER     => $headers,
        ];
        if ($tipo === 'POST' || $tipo === 'PUT') {
            $options[CURLOPT_POSTFIELDS] = json_encode($body);
        }
        curl_setopt_array($curl, $options);
        $response = curl_exec($curl);
        curl_close($curl);
        return $raw ? $response : json_decode($response);
    }

    public function PrepararRequest($body)
    {
        if (! isset($body['api_token'])) {
            $body['api_token'] = $this->api_token;
        }

        if (! isset($body['cp_origen'])) {
            $body['cp_origen'] = $this->cp_origen;
        }

        if (! isset($body['codigo_sucursal'])) {
            $body['codigo_sucursal'] = $this->codigo_sucursal;
        }

        if (! isset($body['sucursal'])) {
            $body['sucursal'] = $this->codigo_sucursal;
        }
        return $body;
    }

    public function services_cache($url)
    {
        $prefijo = $this->cache_key . $url;
        $data = get_transient($prefijo, 'default');
        return $data !== false ? $data : null;
    }

    public function services_cache_save($url, $data, $group = 'default', $expira = 36000)
    {
        $prefijo = $this->cache_key . $url;
        if ($url === $this->services_prices_endpoind) {
            return false;
        }
        if (empty($data) || $data === false || $data === null) {
            return false;
        }
        set_transient($prefijo, $data, $group, $expira);
    }

    public function servicesClientCache($body = [])
    {
        if ($this->services === null) {
            $result = $this->services_cache($this->services_clients_endpoind);
            if ($result === null) {
                $this->services = $this->Api($this->services_clients_endpoind, $body, 'POST');
            } else {
                if (is_string($result)) {
                    $decodificado = json_decode($result, true);
                    if (json_last_error() === JSON_ERROR_NONE) {
                        $this->services = $decodificado;
                    }
                }
            }
            $this->services = $this->Api($this->services_clients_endpoind, $body, 'POST');
        }
    }

    public function ServiciosCliente($body = [])
    {
        $this->servicesClientCache($body);
        $services_client = [];
        if (! isset($this->services->message) && isset($this->services)) {
            foreach ($this->services as $value) {
                if (isset($value->sucursales)) {
                    $services_client[$value->codigo_servicio] = $value->descripcion;
                }
            }
        }
        $this->services_cache_save($this->services_clients_endpoind, $services_client, 3600);
        return $services_client;
    }

    public function SucursalesCliente($body = [])
    {
        $this->servicesClientCache($body);
        $services_client = [];
        if (!empty($this->services) && is_iterable($this->services) && !isset($this->services->message)) {
            foreach ($this->services as $value) {
                if (!is_object($value) || empty($value->id) || empty($value->sucursales)) {
                    continue;
                }
                if (isset($value->sucursales)) {
                    $key = base64_encode($value->descripcion);
                    foreach ($value->sucursales as $sucursal) {
                        $calle     = $sucursal->calle ?? '';
                        $altura    = $sucursal->altura ?? '';
                        $provincia = $sucursal->provincia ?? '';
                        $localidad = $sucursal->localidad ?? '';
                        $cp        = $sucursal->cp ?? '';
                        $id        = $sucursal->id ?? '0';
                        $codigo    = $value->codigo_servicio ?? '0';

                        $sucursal_key = 'sucursal_' . $codigo . '_' . $id;

                        $services_client[$key][$sucursal_key]['sucursal'] = "$calle $altura";
                        $services_client[$key][$sucursal_key]['descripcion'] = "$calle $altura $provincia $localidad $cp";
                    }
                }
            }
        }
        $this->services_cache_save($this->services_clients_endpoind, $services_client, 3600);
        return $services_client;
    }

    public function TodoServicios($body = [])
    {
        $this->servicesClientCache($body);
        $services_client = [];
        if ($this->services && ! isset($this->services->message)) {
            foreach ($this->services as $value) {
                $services_client[$value->codigo_servicio] = $value->descripcion;
            }
        }
        $this->services_cache_save($this->services_clients_endpoind, $services_client, 3600);
        return $services_client;
    }

    public function Estados($body = [])
    {
        return $this->Api($this->estados_endpoind, $body, 'POST');
    }

    public function ActivarNotificaciones($body = [])
    {
        return $this->Api($this->cambio_estados_endpoind, $body, 'POST');
    }

    public function VefificarConexion($body = [])
    {
        return $this->Api($this->dummy_endpoind, $body, 'POST');
    }

    public function EnviarMultiGuias($body = [])
    {
        return $this->Api($this->multi_guias_endpoind, $body, 'POST');
    }

    public function ObtenerPrecioServicios($body)
    {
        return $this->Api($this->services_prices_endpoind, $body, 'POST');
    }

    public function VaciarCache()
    {
        $this->services = null;
    }

    public function ImprimirEtiquetas($guias = [])
    {
        if (is_array($guias)) {
            $guias = implode(',', $guias);
        }
        $body['ids'] = $guias;
        $result = $this->Api($this->package_label_endpoind, $body, 'POST', true);
        if (substr($result, 0, 5) === '%PDF-') {
            $this->tipo_etiqueta = "PDF";
        } else {
            $this->tipo_etiqueta = "HTML";
        }
        return [
            "tipo"    => $this->tipo_etiqueta,
            "archivo" => $result,
        ];
    }

    public function ImprimirRemitos($guias = [])
    {
        if (is_array($guias)) {
            $guias = implode(',', $guias);
        }
        $body['ids'] = $guias;
        $result = $this->Api($this->package_documentation_endpoind, $body, 'POST', true);
        if (substr($result, 0, 5) === '%PDF-') {
            $this->tipo_remito = "PDF";
        } else {
            $this->tipo_remito = "HTML";
        }
        return [
            "tipo"    => $this->tipo_remito,
            "archivo" => $result,
        ];
    }

    public function SeguimientoRemito($remito)
    {
        return $this->Api($this->tracking_endpoind, ["remito" => $remito], 'POST');
    }

    public function VerificarVersion($data)
    {
        return $this->Api($this->version_endpoind, $data, 'POST');
    }
}
