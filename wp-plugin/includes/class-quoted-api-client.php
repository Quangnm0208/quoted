<?php
/**
 * Backend API client.
 *
 * Wraps wp_remote_request with JWT auth, retries, error normalization.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_Api_Client {

	const DEFAULT_TIMEOUT = 15;

	/**
	 * Public (no auth) request — used for llms.txt and markdown endpoints
	 * fetched server-side.
	 */
	public function get_public( $path, $args = array() ) {
		$url = $this->build_url( $path );

		// Tenant identity is conveyed in the path / JWT, not via a forged
		// Host header. Earlier versions set Host: <home_url host> which broke
		// vhost routing on Cloudflare/Fly.io. Let WP set Host from the URL.
		$response = wp_remote_get( $url, array(
			'timeout' => self::DEFAULT_TIMEOUT,
			'headers' => array(
				'User-Agent'      => 'Quoted-WP/' . QUOTED_VERSION,
				'Accept'          => 'text/markdown, application/json',
				'X-Quoted-Domain' => $this->wp_host(),
			),
		) );

		return $this->normalize( $response );
	}

	/**
	 * Hostname of this WordPress site (no scheme, no www prefix).
	 * Used by the backend to map the request to a tenant.
	 */
	private function wp_host() {
		$host = wp_parse_url( home_url(), PHP_URL_HOST );
		return strtolower( preg_replace( '/^www\./', '', (string) $host ) );
	}

	/**
	 * Authenticated request.
	 */
	public function request( $method, $path, $body = null, $retries = 1 ) {
		$jwt = get_option( 'quoted_jwt', '' );

		if ( empty( $jwt ) ) {
			return new WP_Error( 'no_jwt', __( 'Not connected to Quoted backend.', 'quoted' ) );
		}

		$url = $this->build_url( $path );

		$args = array(
			'method'  => $method,
			'timeout' => self::DEFAULT_TIMEOUT,
			'headers' => array(
				'Authorization' => 'Bearer ' . $jwt,
				'Content-Type'  => 'application/json',
				'User-Agent'    => 'Quoted-WP/' . QUOTED_VERSION,
				'Accept'        => 'application/json',
			),
		);

		if ( $body !== null ) {
			$args['body'] = wp_json_encode( $body );
		}

		$response = wp_remote_request( $url, $args );
		$normalized = $this->normalize( $response );

		// If 401 and we have retries: try refreshing token once.
		if ( is_wp_error( $normalized ) && $normalized->get_error_code() === 'http_401' && $retries > 0 ) {
			if ( $this->refresh_token() ) {
				return $this->request( $method, $path, $body, $retries - 1 );
			}
		}

		return $normalized;
	}

	/**
	 * Unauthenticated request (used for /register).
	 */
	public function request_unauthenticated( $method, $path, $body = null ) {
		$url = $this->build_url( $path );

		$args = array(
			'method'  => $method,
			'timeout' => self::DEFAULT_TIMEOUT,
			'headers' => array(
				'Content-Type' => 'application/json',
				'User-Agent'   => 'Quoted-WP/' . QUOTED_VERSION,
				'Accept'       => 'application/json',
			),
		);

		if ( $body !== null ) {
			$args['body'] = wp_json_encode( $body );
		}

		$response = wp_remote_request( $url, $args );
		return $this->normalize( $response );
	}

	private function refresh_token() {
		$result = $this->request_unauthenticated_with_existing_jwt( 'POST', '/api/v1/wp-sites/refresh-token' );

		if ( ! is_wp_error( $result ) && isset( $result['jwt'] ) ) {
			update_option( 'quoted_jwt', $result['jwt'] );
			update_option( 'quoted_jwt_expires_at', strtotime( $result['jwt_expires_at'] ) );
			return true;
		}

		return false;
	}

	private function request_unauthenticated_with_existing_jwt( $method, $path ) {
		$jwt = get_option( 'quoted_jwt', '' );
		$url = $this->build_url( $path );

		$response = wp_remote_request( $url, array(
			'method'  => $method,
			'timeout' => self::DEFAULT_TIMEOUT,
			'headers' => array(
				'Authorization' => 'Bearer ' . $jwt,
				'Content-Type'  => 'application/json',
				'User-Agent'    => 'Quoted-WP/' . QUOTED_VERSION,
			),
		) );

		return $this->normalize( $response );
	}

	private function build_url( $path ) {
		$base = rtrim( get_option( 'quoted_backend_url', '' ), '/' );
		if ( empty( $base ) ) {
			$base = 'https://api.quoted.io'; // TODO: replace with production URL on launch
		}
		return $base . $path;
	}

	/**
	 * Normalize wp_remote_request response:
	 *  - Network error → WP_Error
	 *  - HTTP 4xx/5xx → WP_Error with code http_{status} and message from response body
	 *  - HTTP 2xx with JSON body → decoded array
	 *  - HTTP 2xx with non-JSON body → raw string
	 */
	private function normalize( $response ) {
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$body = wp_remote_retrieve_body( $response );
		$content_type = wp_remote_retrieve_header( $response, 'content-type' );

		$is_json = stripos( $content_type, 'application/json' ) !== false;
		$decoded = $is_json ? json_decode( $body, true ) : $body;

		if ( $code >= 400 ) {
			$error_code = 'http_' . $code;
			$error_message = '';
			$error_data = null;

			if ( $is_json && is_array( $decoded ) && isset( $decoded['error'] ) ) {
				$error_code = isset( $decoded['error']['code'] ) ? $decoded['error']['code'] : $error_code;
				$error_message = isset( $decoded['error']['message'] ) ? $decoded['error']['message'] : '';
				$error_data = isset( $decoded['error']['details'] ) ? $decoded['error']['details'] : null;
			} else {
				$error_message = sprintf( __( 'HTTP %d from backend', 'quoted' ), $code );
			}

			return new WP_Error( $error_code, $error_message, $error_data );
		}

		return $decoded;
	}
}
