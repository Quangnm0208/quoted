<?php
/**
 * Public-facing hooks: bot detection on frontend, llms.txt route, badge.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_Public {

	/**
	 * Hook on `init` priority 1: catch bot visits before WP does anything heavy.
	 *
	 * We never block bots. We just log.
	 * Performance budget: ≤2ms per request.
	 */
	public function detect_bot_visit() {
		// Skip when logging disabled.
		if ( get_option( 'quoted_disable_logging', false ) ) {
			return;
		}

		// Only on frontend GET requests. Skip REST and XML-RPC too — a bot
		// hitting /wp-json/quoted/v1/llm/foo otherwise triggers the
		// detector twice (once on init, once on the REST request).
		// wp_is_xmlrpc_request() exists since WP 4.5 but is missing in some
		// stripped runtimes (e.g. WordPress Playground); guard with function_exists().
		if ( is_admin() || wp_doing_ajax() || wp_doing_cron()
			|| ( defined( 'REST_REQUEST' ) && REST_REQUEST )
			|| ( function_exists( 'wp_is_xmlrpc_request' ) && wp_is_xmlrpc_request() ) ) {
			return;
		}

		if ( ! isset( $_SERVER['REQUEST_METHOD'] ) || $_SERVER['REQUEST_METHOD'] !== 'GET' ) {
			return;
		}

		$ua = isset( $_SERVER['HTTP_USER_AGENT'] ) ? wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) : '';
		if ( empty( $ua ) ) {
			return;
		}

		$detector = new Quoted_Bot_Detector();
		$bot_name = $detector->identify( $ua );

		if ( $bot_name === null ) {
			return; // Not an AI bot.
		}

		$url_path = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '/';
		$ip_raw   = $this->get_client_ip();

		$detector->log_crawl( $bot_name, $url_path, $ua, $ip_raw );
	}

	/**
	 * Render "Powered by Quoted" badge in footer (free tier only).
	 */
	public function render_powered_by_badge() {
		$plan = get_option( 'quoted_plan', 'free' );
		$show = get_option( 'quoted_show_badge', true );

		// On free tier, badge is mandatory.
		if ( $plan !== 'free' && ! $show ) {
			return;
		}

		// Only render if connected.
		$license = new Quoted_License();
		if ( ! $license->is_connected() ) {
			return;
		}

		echo '<div style="text-align:center;padding:10px;font-size:11px;color:#999;">';
		echo 'AI-readable via ';
		echo '<a href="https://quoted.io" target="_blank" rel="noopener" style="color:#666;">Quoted</a>';
		echo '</div>';
	}

	/**
	 * Add /llms.txt rewrite rule that routes to our REST endpoint.
	 */
	public function add_rewrite_rules() {
		add_rewrite_rule(
			'^llms\.txt$',
			'index.php?quoted_route=llms_txt',
			'top'
		);
	}

	public function add_query_vars( $vars ) {
		$vars[] = 'quoted_route';
		return $vars;
	}

	/**
	 * Serve llms.txt content when rewrite rule matches.
	 *
	 * This runs before WP's template loader, so we can send raw markdown
	 * with the correct Content-Type.
	 */
	public function maybe_serve_llms_txt() {
		$route = get_query_var( 'quoted_route' );
		if ( $route !== 'llms_txt' ) {
			return;
		}

		$llms = new Quoted_Llms_Txt();
		$content = $llms->get_content();

		status_header( 200 );
		header( 'Content-Type: text/markdown; charset=utf-8' );
		header( 'Cache-Control: public, max-age=300, s-maxage=86400' );
		header( 'X-Quoted-Version: ' . QUOTED_VERSION );

		echo $content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped — markdown body
		exit;
	}

	/**
	 * Best-effort client IP detection.
	 *
	 * Forwarded-for / Cloudflare headers are only honored when the operator
	 * explicitly opts in via `quoted_trust_proxy`. On a non-proxied install
	 * those headers are attacker-controlled and would let bot traffic spoof
	 * IPs to drown out dedup. REMOTE_ADDR is always consulted last.
	 */
	private function get_client_ip() {
		$keys = array( 'REMOTE_ADDR' );
		if ( get_option( 'quoted_trust_proxy', false ) ) {
			$keys = array( 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR' );
		}
		foreach ( $keys as $key ) {
			if ( ! empty( $_SERVER[ $key ] ) ) {
				$ip = trim( explode( ',', $_SERVER[ $key ] )[0] );
				if ( filter_var( $ip, FILTER_VALIDATE_IP ) ) {
					return $ip;
				}
			}
		}
		return '0.0.0.0';
	}
}
