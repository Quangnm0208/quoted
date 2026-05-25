<?php
/**
 * Backend HTTP client — thin wrapper around the Quoted backend API.
 *
 * Centralises:
 *   - Backend base URL resolution (constant + filter override).
 *   - JSON body encoding + Authorization header for activation_token routes.
 *   - Error envelope normalisation (always returns array or WP_Error).
 *
 * The plugin holds NO Lemon Squeezy API key. All LS calls happen
 * server-side. The plugin only knows about our backend.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_Backend_Client {

	const DEFAULT_BASE_URL = 'https://api.quotedeasy.com';
	const HTTP_TIMEOUT     = 15;

	/**
	 * Resolve the backend base URL. Order of precedence:
	 *   1. quoted_backend_url WP option (admin override)
	 *   2. QUOTED_BACKEND_URL constant
	 *   3. quoted_backend_url filter
	 *   4. self::DEFAULT_BASE_URL
	 *
	 * @return string Base URL with no trailing slash.
	 */
	public static function base_url() {
		$url = get_option( 'quoted_backend_url', '' );
		if ( empty( $url ) && defined( 'QUOTED_BACKEND_URL' ) ) {
			$url = QUOTED_BACKEND_URL;
		}
		if ( empty( $url ) ) {
			$url = self::DEFAULT_BASE_URL;
		}
		/**
		 * Filter the Quoted backend base URL. Useful for staging or self-hosted
		 * deployments where the operator wants to point the plugin at their own
		 * backend without changing the constant.
		 *
		 * @param string $url Resolved base URL.
		 */
		$url = apply_filters( 'quoted_backend_url', $url );
		return rtrim( (string) $url, '/' );
	}

	/**
	 * POST JSON to a backend path. Returns decoded body array on 2xx,
	 * WP_Error on transport/HTTP error. The WP_Error code is the backend's
	 * `error.code` (e.g. 'LICENSE_EXPIRED') so callers can branch on it.
	 *
	 * @param string $path   Path beginning with '/' (e.g. '/api/v1/licenses/activate').
	 * @param array  $body   JSON-serializable payload.
	 * @param string $token  Optional activation token to send as Bearer.
	 * @return array|WP_Error
	 */
	public static function post_json( $path, $body, $token = '' ) {
		$url = self::base_url() . $path;

		$headers = array(
			'Accept'       => 'application/json',
			'Content-Type' => 'application/json',
			'User-Agent'   => 'Quoted-WP/' . QUOTED_VERSION,
		);
		if ( ! empty( $token ) ) {
			$headers['Authorization'] = 'Bearer ' . $token;
		}

		$response = wp_remote_post( $url, array(
			'timeout' => self::HTTP_TIMEOUT,
			'headers' => $headers,
			'body'    => wp_json_encode( $body ),
		) );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$json = json_decode( $raw, true );

		if ( $code >= 200 && $code < 300 ) {
			if ( ! is_array( $json ) ) {
				return new WP_Error( 'bad_json', __( 'Backend returned a non-JSON body.', 'quoted' ) );
			}
			return $json;
		}

		// Map backend error envelope { error: { code, message, details } }
		// onto WP_Error for the caller.
		$err_code = 'http_' . $code;
		$err_msg  = sprintf( __( 'Backend returned HTTP %d.', 'quoted' ), $code );
		$err_data = null;
		if ( is_array( $json ) && isset( $json['error'] ) && is_array( $json['error'] ) ) {
			$err_code = isset( $json['error']['code'] )    ? (string) $json['error']['code']    : $err_code;
			$err_msg  = isset( $json['error']['message'] ) ? (string) $json['error']['message'] : $err_msg;
			$err_data = isset( $json['error']['details'] ) ? $json['error']['details']           : null;
		}
		return new WP_Error( $err_code, $err_msg, $err_data );
	}
}
