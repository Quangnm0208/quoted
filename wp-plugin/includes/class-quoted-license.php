<?php
/**
 * License management — Quoted backend integration (v0.4.0+).
 *
 * Architecture (v0.4.0 rewrite — see docs/ARCHITECTURE-COMMERCIAL.md):
 *   - Customer pays via Lemon Squeezy hosted checkout (on quotedeasy.com).
 *   - LS webhook hits api.quotedeasy.com → backend creates entitlement.
 *   - Plugin POSTs license_key to /api/v1/licenses/activate → backend proxies
 *     to LS License API server-side, returns an activation_token (HS256).
 *   - Plugin stores activation_token + plan + features in WP options.
 *   - Plugin uses activation_token for /validate (daily cron) and /deactivate.
 *
 * The plugin holds NO Lemon Squeezy API key. All LS calls happen server-side.
 *
 * Public interface preserved from v0.3.0 so existing callers (admin UI,
 * cron handler, billing page) keep working:
 *   activate( $license_key )    — returns array or WP_Error
 *   validate()                  — returns bool
 *   cron_revalidate()           — cron handler
 *   deactivate()                — clears local state + best-effort backend call
 *   is_connected()              — returns bool
 *   ::current_plan()            — returns 'free'|'pro'|'agency'
 *
 * Storage keys (WP options):
 *   quoted_license_key        — plaintext UUID (needed for deactivate API call)
 *   quoted_activation_token   — our HS256 JWT (bearer for /validate, /deactivate)
 *   quoted_license_status     — 'active' | 'expired' | 'disabled'
 *   quoted_license_expires_at — unix ts (null = perpetual)
 *   quoted_license_validated_at — unix ts of last /validate success
 *   quoted_customer_email     — for display
 *   quoted_plan               — 'free' | 'pro' | 'agency'
 *   quoted_plan_id            — full plan id ('pro-monthly', etc.)
 *   quoted_features           — JSON of feature flags
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_License {

	/**
	 * Activate a license key against the Quoted backend.
	 *
	 * @param string $license_key UUID-format key from the customer's LS welcome email.
	 * @return array|WP_Error On success: ['plan','plan_id','features','expires_at']. On failure: WP_Error.
	 */
	public function activate( $license_key ) {
		$license_key = trim( (string) $license_key );

		if ( empty( $license_key ) ) {
			return new WP_Error( 'empty_key', __( 'License key is required.', 'quoted' ) );
		}

		// LS keys are UUIDs. Be forgiving on case + dashes-only.
		if ( ! preg_match( '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $license_key ) ) {
			return new WP_Error(
				'invalid_format',
				__( 'License key format looks wrong. Expected the UUID we emailed you (e.g. 38b1460a-5104-4067-a91d-77b872934d51).', 'quoted' )
			);
		}

		$site_url = home_url( '/' );

		$result = Quoted_Backend_Client::post_json( '/api/v1/licenses/activate', array(
			'license_key'    => $license_key,
			'site_url'       => $site_url,
			'plugin_version' => QUOTED_VERSION,
			'wp_version'     => get_bloginfo( 'version' ),
		) );

		if ( is_wp_error( $result ) ) {
			return $result;  // backend error envelope already mapped to WP_Error
		}

		if ( empty( $result['activation_token'] ) ) {
			return new WP_Error( 'no_token', __( 'Backend did not return an activation token.', 'quoted' ) );
		}

		// Persist activation state.
		update_option( 'quoted_license_key',          $license_key );
		update_option( 'quoted_activation_token',     (string) $result['activation_token'] );
		update_option( 'quoted_license_status',       'active' );
		update_option( 'quoted_license_validated_at', time() );
		update_option( 'quoted_plan',                 isset( $result['plan_tier'] ) ? (string) $result['plan_tier'] : 'free' );
		update_option( 'quoted_plan_id',              isset( $result['plan'] ) ? (string) $result['plan'] : '' );
		update_option( 'quoted_features',             wp_json_encode( isset( $result['features'] ) ? $result['features'] : new stdClass() ) );

		if ( ! empty( $result['expires_at'] ) ) {
			$ts = strtotime( (string) $result['expires_at'] );
			if ( $ts !== false ) {
				update_option( 'quoted_license_expires_at', $ts );
			}
		} else {
			delete_option( 'quoted_license_expires_at' );
		}

		// After activate succeeds, register the WP site so the runtime endpoints
		// (sync, dashboard, bot-crawls) can use the plugin-JWT. Backend register
		// requires the activation_token we just minted.
		$this->register_site_after_activation( $result['activation_token'] );

		return $result;
	}

	/**
	 * Re-validate the stored activation token. Called by daily cron.
	 *
	 * @return bool true if still active, false if expired/disabled/invalid.
	 */
	public function validate() {
		$token = (string) get_option( 'quoted_activation_token', '' );
		if ( empty( $token ) ) {
			return false;
		}

		$result = Quoted_Backend_Client::post_json(
			'/api/v1/licenses/validate',
			array( 'site_url' => home_url( '/' ) ),
			$token
		);

		if ( is_wp_error( $result ) ) {
			// Token expired or license disabled — clear the active state but keep
			// the license_key so the user can re-activate with one click.
			$err_code = $result->get_error_code();
			if ( in_array( $err_code, array( 'TOKEN_INVALID', 'LICENSE_EXPIRED', 'LICENSE_DISABLED', 'ENTITLEMENT_INACTIVE' ), true ) ) {
				update_option( 'quoted_license_status', $err_code === 'LICENSE_EXPIRED' ? 'expired' : 'disabled' );
			}
			return false;
		}

		update_option( 'quoted_license_status',       'active' );
		update_option( 'quoted_license_validated_at', time() );

		if ( ! empty( $result['plan'] ) ) {
			update_option( 'quoted_plan_id', (string) $result['plan'] );
		}
		if ( ! empty( $result['features'] ) && is_array( $result['features'] ) ) {
			update_option( 'quoted_features', wp_json_encode( $result['features'] ) );
		}

		return true;
	}

	public function cron_revalidate() {
		$this->validate();
	}

	/**
	 * Deactivate the seat on the backend, then clear local state.
	 * Always clears local options even if the backend call fails.
	 */
	public function deactivate() {
		$token       = (string) get_option( 'quoted_activation_token', '' );
		$license_key = (string) get_option( 'quoted_license_key', '' );

		if ( ! empty( $token ) ) {
			Quoted_Backend_Client::post_json(
				'/api/v1/licenses/deactivate',
				array(
					'site_url'    => home_url( '/' ),
					'license_key' => $license_key,  // forwarded to LS API server-side
				),
				$token
			);
		}

		delete_option( 'quoted_license_key' );
		delete_option( 'quoted_activation_token' );
		delete_option( 'quoted_license_status' );
		delete_option( 'quoted_license_expires_at' );
		delete_option( 'quoted_license_validated_at' );
		delete_option( 'quoted_customer_email' );
		delete_option( 'quoted_plan_id' );
		delete_option( 'quoted_features' );
		update_option( 'quoted_plan', 'free' );
		update_option( 'quoted_onboarded', false );
	}

	/**
	 * Plugin is "connected" when we have an activation token AND the last
	 * validate marked the status as active. Cron failures degrade gracefully:
	 * status flips to 'expired'/'disabled' but the option row persists so
	 * the admin UI shows the customer WHY they need to re-activate.
	 */
	public function is_connected() {
		if ( empty( get_option( 'quoted_activation_token', '' ) ) ) {
			return false;
		}
		return 'active' === (string) get_option( 'quoted_license_status', '' );
	}

	/**
	 * Convenience getter — current plan tier ('free' | 'pro' | 'agency').
	 */
	public static function current_plan() {
		$plan = (string) get_option( 'quoted_plan', 'free' );
		return in_array( $plan, array( 'free', 'pro', 'agency' ), true ) ? $plan : 'free';
	}

	/**
	 * Register the WP site against the backend (runtime endpoint). Internal —
	 * called automatically after a successful activate(). Stores the plugin
	 * JWT used by /posts/sync, /bot-crawls/batch, /dashboard/summary.
	 *
	 * Best-effort: site registration failing does NOT roll back activation.
	 * The admin UI can re-attempt registration manually.
	 */
	private function register_site_after_activation( $activation_token ) {
		$result = Quoted_Backend_Client::post_json( '/api/v1/wp-sites/register', array(
			'activation_token' => $activation_token,
			'domain'           => wp_parse_url( home_url( '/' ), PHP_URL_HOST ),
			'site_name'        => get_bloginfo( 'name' ),
			'admin_email'      => get_bloginfo( 'admin_email' ),
			'wp_version'       => get_bloginfo( 'version' ),
			'plugin_version'   => QUOTED_VERSION,
		) );

		if ( is_wp_error( $result ) ) {
			// Log but don't surface — activation itself succeeded.
			error_log( '[Quoted] site registration failed: ' . $result->get_error_code() . ' — ' . $result->get_error_message() );
			return;
		}

		if ( ! empty( $result['jwt'] ) ) {
			update_option( 'quoted_plugin_jwt',            (string) $result['jwt'] );
			update_option( 'quoted_plugin_jwt_expires_at', isset( $result['jwt_expires_at'] ) ? strtotime( (string) $result['jwt_expires_at'] ) : 0 );
		}
		if ( ! empty( $result['tenant_id'] ) ) {
			update_option( 'quoted_tenant_id', (int) $result['tenant_id'] );
		}
	}
}
