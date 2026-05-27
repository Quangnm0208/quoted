<?php
/**
 * Public-facing hooks: bot detection, llms.txt route, robots.txt filter, footer badge.
 *
 * @package QuotedEasy_AI_Readiness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class QuotedEasy_AI_Readiness_Public {

	public function detect_bot_visit() {
		if ( get_option( 'quotedeasy_ai_readiness_disable_logging', false ) ) {
			return;
		}

		if ( is_admin() || wp_doing_ajax() || wp_doing_cron()
			|| ( defined( 'REST_REQUEST' ) && REST_REQUEST )
			|| ( function_exists( 'wp_is_xmlrpc_request' ) && wp_is_xmlrpc_request() ) ) {
			return;
		}

		$method = isset( $_SERVER['REQUEST_METHOD'] )
			? sanitize_key( wp_unslash( $_SERVER['REQUEST_METHOD'] ) )
			: '';
		if ( $method !== 'get' ) {
			return;
		}

		$ua = isset( $_SERVER['HTTP_USER_AGENT'] )
			? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) )
			: '';
		if ( $ua === '' ) {
			return;
		}

		$detector = new QuotedEasy_AI_Readiness_Bot_Detector();
		$bot_name = $detector->identify( $ua );

		if ( $bot_name === null ) {
			return;
		}

		$url_path = isset( $_SERVER['REQUEST_URI'] )
			? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) )
			: '/';
		$ip_raw   = $this->get_client_ip();

		$detector->log_crawl( $bot_name, $url_path, $ua, $ip_raw );

		if ( ! QuotedEasy_AI_Readiness_Bot_Detector::is_allowed( $bot_name ) ) {
			status_header( 403 );
			header( 'X-QuotedEasy-Block: ' . $bot_name );
			header( 'Content-Type: text/plain; charset=utf-8' );
			header( 'Cache-Control: no-store, no-cache, must-revalidate, max-age=0' );
			echo 'Access disallowed for AI crawler ' . esc_html( $bot_name ) . " by the site operator. See /robots.txt.\n";
			exit;
		}
	}

	public function render_powered_by_badge() {
		echo '<div style="text-align:center;padding:10px;font-size:11px;color:#999;">';
		echo 'AI-ready via ';
		echo '<a href="https://github.com/muahangngayvn/quotedeasy-ai-readiness" target="_blank" rel="noopener" style="color:#666;">QuotedEasy</a>';
		echo '</div>';
	}

	public function add_rewrite_rules() {
		add_rewrite_rule(
			'^llms\.txt/?$',
			'index.php?quotedeasy_ai_readiness_route=llms_txt',
			'top'
		);
	}

	public function add_query_vars( $vars ) {
		$vars[] = 'quotedeasy_ai_readiness_route';
		return $vars;
	}

	public function filter_robots_txt( $output, $public ) {
		if ( ! $public ) {
			return $output;
		}
		return $output . QuotedEasy_AI_Readiness_Bot_Detector::robots_txt_block_rules();
	}

	public function maybe_serve_llms_txt() {
		$route = get_query_var( 'quotedeasy_ai_readiness_route' );
		if ( $route !== 'llms_txt' ) {
			return;
		}

		$llms    = new QuotedEasy_AI_Readiness_Llms_Txt();
		$content = $llms->get_content();

		status_header( 200 );
		header( 'Content-Type: text/markdown; charset=utf-8' );
		header( 'Cache-Control: public, max-age=300, must-revalidate' );
		header( 'X-QuotedEasy-Version: ' . QUOTEDEASY_AI_READINESS_VERSION );

		echo $content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		exit;
	}

	private function get_client_ip() {
		$keys = array( 'REMOTE_ADDR' );
		if ( get_option( 'quotedeasy_ai_readiness_trust_proxy', false ) ) {
			$keys = array( 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR' );
		}
		foreach ( $keys as $key ) {
			if ( empty( $_SERVER[ $key ] ) ) {
				continue;
			}
			$raw = sanitize_text_field( wp_unslash( $_SERVER[ $key ] ) );
			$ip  = trim( explode( ',', $raw )[0] );
			if ( filter_var( $ip, FILTER_VALIDATE_IP ) ) {
				return $ip;
			}
		}
		return '0.0.0.0';
	}
}
