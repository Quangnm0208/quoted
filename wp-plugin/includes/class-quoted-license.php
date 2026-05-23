<?php
/**
 * License activation + storage.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_License {

	/**
	 * Activate a license key against the backend.
	 *
	 * @param string $license_key The customer's license key.
	 * @param string $backend_url The backend URL (e.g., https://api.quoted.io).
	 * @return array|WP_Error On success, returns ['tenant_id', 'plan', 'quota']. On failure, WP_Error.
	 */
	public function activate( $license_key, $backend_url ) {
		$license_key = trim( $license_key );
		$backend_url = trim( $backend_url );

		if ( empty( $license_key ) ) {
			return new WP_Error( 'empty_key', __( 'License key is required.', 'quoted' ) );
		}

		if ( ! preg_match( '/^qtd_(live|test)_[a-zA-Z0-9_-]{20,}$/', $license_key ) ) {
			return new WP_Error( 'invalid_format', __( 'License key format looks wrong. It should start with qtd_live_ or qtd_test_.', 'quoted' ) );
		}

		if ( ! empty( $backend_url ) && ! filter_var( $backend_url, FILTER_VALIDATE_URL ) ) {
			return new WP_Error( 'invalid_url', __( 'Backend URL is not a valid URL.', 'quoted' ) );
		}

		// Persist backend URL so the API client can find it.
		update_option( 'quoted_backend_url', $backend_url );

		$api = new Quoted_Api_Client();
		$result = $api->request_unauthenticated(
			'POST',
			'/api/v1/wp-sites/register',
			array(
				'license_key'     => $license_key,
				'domain'          => $this->get_site_domain(),
				'wp_version'      => get_bloginfo( 'version' ),
				'plugin_version'  => QUOTED_VERSION,
				'site_name'       => get_bloginfo( 'name' ),
				'admin_email'     => get_bloginfo( 'admin_email' ),
			)
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		if ( empty( $result['jwt'] ) || empty( $result['tenant_id'] ) ) {
			return new WP_Error( 'invalid_response', __( 'Backend returned an unexpected response.', 'quoted' ) );
		}

		// Persist state.
		update_option( 'quoted_license_key', $license_key );
		update_option( 'quoted_jwt', $result['jwt'] );
		update_option( 'quoted_jwt_expires_at', isset( $result['jwt_expires_at'] ) ? strtotime( $result['jwt_expires_at'] ) : ( time() + 86400 ) );
		update_option( 'quoted_tenant_id', $result['tenant_id'] );
		update_option( 'quoted_plan', isset( $result['plan'] ) ? $result['plan'] : 'free' );

		return $result;
	}

	/**
	 * Check if plugin is currently connected.
	 */
	public function is_connected() {
		$jwt = get_option( 'quoted_jwt', '' );
		$expires_at = (int) get_option( 'quoted_jwt_expires_at', 0 );

		return ! empty( $jwt ) && $expires_at > time();
	}

	/**
	 * Disconnect — clears local state. Does not revoke license on backend.
	 */
	public function disconnect() {
		delete_option( 'quoted_jwt' );
		delete_option( 'quoted_jwt_expires_at' );
		delete_option( 'quoted_license_key' );
		delete_option( 'quoted_tenant_id' );
		delete_option( 'quoted_plan' );
		update_option( 'quoted_onboarded', false );
	}

	/**
	 * Get the site domain WITHOUT www prefix (matches backend normalization).
	 */
	private function get_site_domain() {
		$url = home_url();
		$host = parse_url( $url, PHP_URL_HOST );
		$host = preg_replace( '/^www\./', '', $host );
		return strtolower( $host );
	}
}
