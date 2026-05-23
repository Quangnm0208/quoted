<?php
/**
 * License management — Lemon Squeezy License API direct integration.
 *
 * No self-hosted backend. The plugin talks to https://api.lemonsqueezy.com/v1/licenses/
 * directly with the customer's license key. LS handles activation tracking
 * (multi-site limits, expiry, revocation).
 *
 * Reference: https://docs.lemonsqueezy.com/api/license-api
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_License {

	const LS_API_BASE = 'https://api.lemonsqueezy.com/v1/licenses';
	const HTTP_TIMEOUT = 15;

	/**
	 * Map Lemon Squeezy variant_name → internal plan code.
	 *
	 * Update this when LS product names change. Variant names are
	 * what the operator typed when creating the LS product variants.
	 * Anything not matched here defaults to 'free'.
	 */
	private static function variant_to_plan_map() {
		return array(
			'Solo'   => 'solo',
			'Pro+'   => 'pro_plus',
			'Pro Plus' => 'pro_plus',
		);
	}

	/**
	 * Activate a license key against Lemon Squeezy.
	 *
	 * Stores the resulting instance_id locally so we can revalidate /
	 * deactivate later. Stores the plan derived from variant_name so the
	 * plugin can gate Pro features without re-hitting LS on every request.
	 *
	 * @param string $license_key UUID-format key (from LS welcome email).
	 * @return array|WP_Error On success: ['plan','variant_name','expires_at']. On failure: WP_Error.
	 */
	public function activate( $license_key ) {
		$license_key = trim( (string) $license_key );

		if ( empty( $license_key ) ) {
			return new WP_Error( 'empty_key', __( 'License key is required.', 'quoted' ) );
		}

		// LS keys are UUIDs (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). Be forgiving on case.
		if ( ! preg_match( '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $license_key ) ) {
			return new WP_Error(
				'invalid_format',
				__( 'License key format looks wrong. Expected the UUID we emailed you (e.g. 38b1460a-5104-4067-a91d-77b872934d51).', 'quoted' )
			);
		}

		// Use site home_url as the instance_name so LS shows it in the seat list.
		$instance_name = wp_parse_url( home_url(), PHP_URL_HOST );
		if ( empty( $instance_name ) ) {
			$instance_name = 'wordpress-site';
		}

		$response = wp_remote_post( self::LS_API_BASE . '/activate', array(
			'timeout' => self::HTTP_TIMEOUT,
			'headers' => array(
				'Accept'     => 'application/json',
				'User-Agent' => 'Quoted-WP/' . QUOTED_VERSION,
			),
			'body' => array(
				'license_key'   => $license_key,
				'instance_name' => $instance_name,
			),
		) );

		$decoded = $this->decode( $response );
		if ( is_wp_error( $decoded ) ) {
			return $decoded;
		}

		// LS returns `activated: true|false`. `false` with `error` means
		// the key is invalid or the activation limit was reached.
		if ( empty( $decoded['activated'] ) ) {
			$msg = ! empty( $decoded['error'] )
				? $decoded['error']
				: __( 'Lemon Squeezy refused to activate this key.', 'quoted' );
			return new WP_Error( 'ls_activation_failed', $msg );
		}

		if ( empty( $decoded['instance']['id'] ) || empty( $decoded['license_key']['status'] ) ) {
			return new WP_Error( 'ls_bad_response', __( 'Lemon Squeezy returned an unexpected response shape.', 'quoted' ) );
		}

		// Derive plan from variant_name in the meta payload.
		$variant_name = isset( $decoded['meta']['variant_name'] ) ? (string) $decoded['meta']['variant_name'] : '';
		$plan = self::variant_to_plan_map()[ $variant_name ] ?? 'free';

		$expires_at = 0;
		if ( ! empty( $decoded['license_key']['expires_at'] ) ) {
			$ts = strtotime( $decoded['license_key']['expires_at'] );
			if ( $ts !== false ) {
				$expires_at = $ts;
			}
		}

		// Persist state.
		update_option( 'quoted_license_key',         $license_key );
		update_option( 'quoted_license_instance_id', $decoded['instance']['id'] );
		update_option( 'quoted_license_status',      $decoded['license_key']['status'] );
		update_option( 'quoted_license_expires_at',  $expires_at );
		update_option( 'quoted_license_validated_at', time() );
		update_option( 'quoted_plan',                $plan );

		// Store a few customer fields for the dashboard / support.
		if ( isset( $decoded['meta']['customer_email'] ) ) {
			update_option( 'quoted_customer_email', sanitize_email( $decoded['meta']['customer_email'] ) );
		}
		if ( isset( $decoded['meta']['variant_name'] ) ) {
			update_option( 'quoted_variant_name', sanitize_text_field( $decoded['meta']['variant_name'] ) );
		}

		return array(
			'plan'         => $plan,
			'variant_name' => $variant_name,
			'expires_at'   => $expires_at,
			'status'       => $decoded['license_key']['status'],
		);
	}

	/**
	 * Validate the stored license against Lemon Squeezy.
	 *
	 * Called by the daily cron hook. If LS reports the key as expired or
	 * disabled, downgrade the local plan to 'free' so Pro features lock.
	 *
	 * @return bool True if license is still valid, false otherwise.
	 */
	public function validate() {
		$license_key = get_option( 'quoted_license_key', '' );
		$instance_id = get_option( 'quoted_license_instance_id', '' );

		if ( empty( $license_key ) || empty( $instance_id ) ) {
			return false;
		}

		$response = wp_remote_post( self::LS_API_BASE . '/validate', array(
			'timeout' => self::HTTP_TIMEOUT,
			'headers' => array(
				'Accept'     => 'application/json',
				'User-Agent' => 'Quoted-WP/' . QUOTED_VERSION,
			),
			'body' => array(
				'license_key' => $license_key,
				'instance_id' => $instance_id,
			),
		) );

		$decoded = $this->decode( $response );
		if ( is_wp_error( $decoded ) ) {
			// Network error — don't downgrade on a transient failure.
			error_log( 'Quoted license validate (transient): ' . $decoded->get_error_message() );
			return true; // Optimistic: leave existing state.
		}

		$status  = isset( $decoded['license_key']['status'] ) ? (string) $decoded['license_key']['status'] : 'unknown';
		$is_valid = ! empty( $decoded['valid'] ) && in_array( $status, array( 'active' ), true );

		update_option( 'quoted_license_status',      $status );
		update_option( 'quoted_license_validated_at', time() );

		if ( ! $is_valid ) {
			// LS says the seat is no longer good — revert plan + clear sensitive fields.
			update_option( 'quoted_plan', 'free' );
			error_log( 'Quoted license downgraded to free: status=' . $status );
			return false;
		}

		// Refresh expiry if LS bumped it.
		if ( ! empty( $decoded['license_key']['expires_at'] ) ) {
			$ts = strtotime( $decoded['license_key']['expires_at'] );
			if ( $ts !== false ) {
				update_option( 'quoted_license_expires_at', $ts );
			}
		}

		return true;
	}

	/**
	 * Cron callback wrapper — keeps the action handler signature clean.
	 */
	public function cron_revalidate() {
		$this->validate();
	}

	/**
	 * Deactivate the seat — frees one activation slot for this license on LS.
	 *
	 * Always clears the local state, even if the LS call fails (network down,
	 * key already deleted on LS side). The customer can always re-activate.
	 */
	public function deactivate() {
		$license_key = get_option( 'quoted_license_key', '' );
		$instance_id = get_option( 'quoted_license_instance_id', '' );

		if ( ! empty( $license_key ) && ! empty( $instance_id ) ) {
			// Best-effort LS API call; ignore errors.
			wp_remote_post( self::LS_API_BASE . '/deactivate', array(
				'timeout' => self::HTTP_TIMEOUT,
				'headers' => array(
					'Accept'     => 'application/json',
					'User-Agent' => 'Quoted-WP/' . QUOTED_VERSION,
				),
				'body' => array(
					'license_key' => $license_key,
					'instance_id' => $instance_id,
				),
			) );
		}

		delete_option( 'quoted_license_key' );
		delete_option( 'quoted_license_instance_id' );
		delete_option( 'quoted_license_status' );
		delete_option( 'quoted_license_expires_at' );
		delete_option( 'quoted_license_validated_at' );
		delete_option( 'quoted_customer_email' );
		delete_option( 'quoted_variant_name' );
		update_option( 'quoted_plan', 'free' );
		update_option( 'quoted_onboarded', false );
	}

	/**
	 * Plugin is "connected" (Pro features unlocked) when we have a license,
	 * an instance_id, and the last validate marked status as active.
	 */
	public function is_connected() {
		if ( empty( get_option( 'quoted_license_key', '' ) ) ) {
			return false;
		}
		if ( empty( get_option( 'quoted_license_instance_id', '' ) ) ) {
			return false;
		}
		$status = get_option( 'quoted_license_status', '' );
		return $status === 'active';
	}

	/**
	 * Convenience getter — current plan code ('free' | 'solo' | 'pro_plus').
	 */
	public static function current_plan() {
		$plan = get_option( 'quoted_plan', 'free' );
		return in_array( $plan, array( 'free', 'solo', 'pro_plus' ), true ) ? $plan : 'free';
	}

	/**
	 * Normalize a wp_remote_post response into either an array (success body)
	 * or a WP_Error (transport error, HTTP 4xx/5xx, non-JSON).
	 */
	private function decode( $response ) {
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$body = wp_remote_retrieve_body( $response );
		$json = json_decode( $body, true );

		if ( $code >= 200 && $code < 300 ) {
			if ( ! is_array( $json ) ) {
				return new WP_Error( 'bad_json', __( 'Lemon Squeezy returned a non-JSON body.', 'quoted' ) );
			}
			return $json;
		}

		$msg = '';
		if ( is_array( $json ) && ! empty( $json['error'] ) ) {
			$msg = (string) $json['error'];
		} else {
			$msg = sprintf( /* translators: %d: HTTP status */ __( 'Lemon Squeezy returned HTTP %d.', 'quoted' ), $code );
		}
		return new WP_Error( 'ls_http_' . $code, $msg );
	}
}
