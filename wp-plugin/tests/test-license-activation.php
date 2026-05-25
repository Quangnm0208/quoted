<?php
/**
 * Quoted WP plugin — lightweight unit tests.
 *
 * No PHPUnit / no WordPress install required. Stubs the small handful of
 * WordPress globals (wp_remote_post, get_option, etc.) the license + backend
 * client touch, then exercises the class methods directly.
 *
 * Run:  php tests/test-license-activation.php
 *
 * Exits 0 on pass, 1 on fail. Designed to be invoked from CI alongside the
 * Node-side tests/quoted-test-*.mjs suite.
 */

// ── WordPress global stubs (loaded BEFORE the classes) ──────────────────────

if ( ! defined( 'ABSPATH' )           ) define( 'ABSPATH', __DIR__ . '/' );
if ( ! defined( 'QUOTED_VERSION' )    ) define( 'QUOTED_VERSION', '0.4.0-test' );

// Option store — replaces WordPress's wp_options table.
$GLOBALS['_options'] = array();

function get_option( $key, $default = '' ) {
	return array_key_exists( $key, $GLOBALS['_options'] ) ? $GLOBALS['_options'][ $key ] : $default;
}
function update_option( $key, $value ) {
	$GLOBALS['_options'][ $key ] = $value;
	return true;
}
function delete_option( $key ) {
	unset( $GLOBALS['_options'][ $key ] );
	return true;
}

// HTTP mock — every test seeds $GLOBALS['_http_mock'] with the next response.
$GLOBALS['_http_mock'] = null;
$GLOBALS['_http_calls'] = array();

function wp_remote_post( $url, $args = array() ) {
	$GLOBALS['_http_calls'][] = array( 'url' => $url, 'args' => $args );
	$mock = $GLOBALS['_http_mock'];
	if ( $mock === null ) {
		return new WP_Error( 'no_mock', 'wp_remote_post called but no mock set' );
	}
	$GLOBALS['_http_mock'] = null;
	return $mock;
}
function wp_remote_retrieve_response_code( $resp ) {
	return is_array( $resp ) && isset( $resp['response']['code'] ) ? (int) $resp['response']['code'] : 0;
}
function wp_remote_retrieve_body( $resp ) {
	return is_array( $resp ) && isset( $resp['body'] ) ? (string) $resp['body'] : '';
}
function wp_json_encode( $data, $flags = 0 ) { return json_encode( $data, $flags ); }
function wp_parse_url( $url, $component = -1 ) { return parse_url( $url, $component ); }
function home_url( $path = '/' )         { return 'https://test.example.com' . $path; }
function get_bloginfo( $name )           {
	$map = array( 'name' => 'Test Site', 'admin_email' => 'admin@test.example.com', 'version' => '6.5' );
	return $map[ $name ] ?? '';
}
function apply_filters( $tag, $value )   { return $value; }
function __( $s, $d = null )             { return $s; }

// WP_Error stub.
class WP_Error {
	private $code; private $message; private $data;
	public function __construct( $code = '', $message = '', $data = null ) {
		$this->code = $code; $this->message = $message; $this->data = $data;
	}
	public function get_error_code()    { return $this->code; }
	public function get_error_message() { return $this->message; }
	public function get_error_data()    { return $this->data; }
}
function is_wp_error( $thing ) { return $thing instanceof WP_Error; }

// ── Load classes under test ─────────────────────────────────────────────────

require_once __DIR__ . '/../includes/class-quoted-backend-client.php';
require_once __DIR__ . '/../includes/class-quoted-license.php';

// ── Test harness ────────────────────────────────────────────────────────────

$fail = 0; $pass = 0;
function ok( $label, $cond, $extra = '' ) {
	global $pass, $fail;
	if ( $cond ) { $pass++; echo "  ✓ $label\n"; }
	else        { $fail++; echo "  ✗ $label\n";
		if ( $extra ) echo "      $extra\n";
	}
}
function reset_state() {
	$GLOBALS['_options'] = array();
	$GLOBALS['_http_mock'] = null;
	$GLOBALS['_http_calls'] = array();
}
function mock_response( $code, $body_array ) {
	$GLOBALS['_http_mock'] = array(
		'response' => array( 'code' => $code ),
		'body'     => json_encode( $body_array ),
	);
}

// ── T-WP-1: activate rejects empty key ─────────────────────────────────────
echo "T-WP-1: activate rejects empty key\n";
reset_state();
$license = new Quoted_License();
$r = $license->activate( '' );
ok( 'returns WP_Error',                 is_wp_error( $r ) );
ok( 'error code = empty_key',           is_wp_error( $r ) && $r->get_error_code() === 'empty_key' );
ok( 'no HTTP call made',                count( $GLOBALS['_http_calls'] ) === 0 );

// ── T-WP-2: activate rejects malformed key ─────────────────────────────────
echo "\nT-WP-2: activate rejects malformed key\n";
reset_state();
$r = ( new Quoted_License() )->activate( 'not-a-uuid' );
ok( 'returns WP_Error',                 is_wp_error( $r ) );
ok( 'error code = invalid_format',      is_wp_error( $r ) && $r->get_error_code() === 'invalid_format' );

// ── T-WP-3: activate happy path stores all options ─────────────────────────
echo "\nT-WP-3: activate happy path stores all options + auto-registers\n";
reset_state();
// First mock response: /licenses/activate
mock_response( 201, array(
	'activation_token' => 'tok.abc.def',
	'plan'             => 'pro-monthly',
	'plan_tier'        => 'pro',
	'features'         => array( 'llms_txt_unlimited' => true ),
	'expires_at'       => null,
	'activation_limit' => 3,
	'instances_count'  => 1,
) );
$r = ( new Quoted_License() )->activate( '8a7b6c5d-1234-5678-9abc-def012345678' );
ok( 'no WP_Error',                      ! is_wp_error( $r ) );
ok( 'option: license_key stored',       get_option( 'quoted_license_key' ) === '8a7b6c5d-1234-5678-9abc-def012345678' );
ok( 'option: activation_token stored',  get_option( 'quoted_activation_token' ) === 'tok.abc.def' );
ok( 'option: license_status = active',  get_option( 'quoted_license_status' ) === 'active' );
ok( 'option: plan = pro',               get_option( 'quoted_plan' ) === 'pro' );
ok( 'option: plan_id = pro-monthly',    get_option( 'quoted_plan_id' ) === 'pro-monthly' );
ok( 'option: features stored as JSON',  strpos( get_option( 'quoted_features' ), 'llms_txt_unlimited' ) !== false );
// activate triggered /wp-sites/register too — second HTTP call. But our mock
// queue only returned one response, so the second call returned WP_Error which
// activate swallows (it's best-effort). Check the URL of the second call.
ok( '2nd HTTP call to /wp-sites/register',
    count( $GLOBALS['_http_calls'] ) >= 2
    && strpos( $GLOBALS['_http_calls'][1]['url'], '/api/v1/wp-sites/register' ) !== false );

// ── T-WP-4: activate maps backend error envelope to WP_Error.code ─────────
echo "\nT-WP-4: activate maps backend error envelope to WP_Error code\n";
reset_state();
mock_response( 410, array( 'error' => array(
	'code' => 'LICENSE_EXPIRED',
	'message' => 'License has expired.',
	'details' => null,
) ) );
$r = ( new Quoted_License() )->activate( '8a7b6c5d-1234-5678-9abc-def012345678' );
ok( 'returns WP_Error',                 is_wp_error( $r ) );
ok( 'code = LICENSE_EXPIRED',           is_wp_error( $r ) && $r->get_error_code() === 'LICENSE_EXPIRED' );
ok( 'message preserved',                is_wp_error( $r ) && $r->get_error_message() === 'License has expired.' );

// ── T-WP-5: validate flips status on TOKEN_INVALID ─────────────────────────
echo "\nT-WP-5: validate flips status on TOKEN_INVALID without losing license_key\n";
reset_state();
update_option( 'quoted_activation_token', 'old.tok' );
update_option( 'quoted_license_key', '8a7b6c5d-1234-5678-9abc-def012345678' );
update_option( 'quoted_license_status', 'active' );
mock_response( 401, array( 'error' => array( 'code' => 'TOKEN_INVALID', 'message' => 'Token expired' ) ) );
$result = ( new Quoted_License() )->validate();
ok( 'validate returns false',           $result === false );
ok( 'status flipped to disabled',       get_option( 'quoted_license_status' ) === 'disabled' );
ok( 'license_key preserved for retry',  get_option( 'quoted_license_key' ) === '8a7b6c5d-1234-5678-9abc-def012345678' );

// ── T-WP-6: deactivate clears local state ──────────────────────────────────
echo "\nT-WP-6: deactivate clears local state even when backend errors\n";
reset_state();
update_option( 'quoted_activation_token', 'tok' );
update_option( 'quoted_license_key', 'key' );
update_option( 'quoted_license_status', 'active' );
update_option( 'quoted_plan', 'pro' );
$GLOBALS['_http_mock'] = new WP_Error( 'http_failure', 'down' );
( new Quoted_License() )->deactivate();
ok( 'activation_token cleared',         get_option( 'quoted_activation_token' ) === '' );
ok( 'license_key cleared',              get_option( 'quoted_license_key' ) === '' );
ok( 'plan reset to free',               get_option( 'quoted_plan' ) === 'free' );

// ── T-WP-7: backend_client URL precedence ──────────────────────────────────
echo "\nT-WP-7: backend client base_url precedence (option > constant > default)\n";
reset_state();
ok( 'default url',                      Quoted_Backend_Client::base_url() === 'https://api.quotedeasy.com' );
update_option( 'quoted_backend_url', 'https://staging.api.test' );
ok( 'option override wins',             Quoted_Backend_Client::base_url() === 'https://staging.api.test' );
delete_option( 'quoted_backend_url' );
// constant precedence is harder to test without runkit; trust the implementation.
ok( 'default restored after delete',    Quoted_Backend_Client::base_url() === 'https://api.quotedeasy.com' );

// ── Summary ────────────────────────────────────────────────────────────────
echo "\n══════════════════════════════════════\n";
echo "  $pass pass, $fail fail\n";
exit( $fail === 0 ? 0 : 1 );
