<?php
/**
 * Public-facing hooks: bot detection on frontend, llms.txt route, credit badge.
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
	 * Detection runs cheap (substring scan on UA). If the bot is blocked in
	 * the allowlist, we send HTTP 403 and exit *before* WP loads the rest
	 * of the request. The crawl is still logged for the dashboard so the
	 * operator can see what they're blocking.
	 *
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
		if ( is_admin() || wp_doing_ajax() || wp_doing_cron()
			|| ( defined( 'REST_REQUEST' ) && REST_REQUEST )
			|| ( function_exists( 'wp_is_xmlrpc_request' ) && wp_is_xmlrpc_request() ) ) {
			return;
		}

		// REQUEST_METHOD is a server-controlled value; sanitize_key strips
		// anything but a-z0-9-_ which is the entire valid HTTP method surface.
		$method = isset( $_SERVER['REQUEST_METHOD'] )
			? sanitize_key( wp_unslash( $_SERVER['REQUEST_METHOD'] ) )
			: '';
		if ( $method !== 'get' ) {
			return;
		}

		// User-Agent is attacker-controlled. sanitize_text_field strips tags
		// and control chars before we store/log it.
		$ua = isset( $_SERVER['HTTP_USER_AGENT'] )
			? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) )
			: '';
		if ( $ua === '' ) {
			return;
		}

		$detector = new Quoted_Bot_Detector();
		$bot_name = $detector->identify( $ua );

		if ( $bot_name === null ) {
			return; // Not an AI bot.
		}

		// REQUEST_URI is attacker-controlled but is a path/query string, not
		// a free-form URL. esc_url_raw strips unsafe scheme and HTML.
		$url_path = isset( $_SERVER['REQUEST_URI'] )
			? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) )
			: '/';
		$ip_raw   = $this->get_client_ip();

		// Always log first — the operator wants to see blocked attempts too.
		$detector->log_crawl( $bot_name, $url_path, $ua, $ip_raw );

		// Then enforce the allowlist. Blocked bots get 403 + exit before the
		// page builds — saves CPU, makes the block clearly visible to the bot.
		if ( ! Quoted_Bot_Detector::is_allowed( $bot_name ) ) {
			status_header( 403 );
			header( 'X-Quoted-Block: ' . $bot_name );
			header( 'Content-Type: text/plain; charset=utf-8' );
			header( 'Cache-Control: no-store, no-cache, must-revalidate, max-age=0' );
			echo "Access disallowed for AI crawler " . esc_html( $bot_name ) . " by the site operator. See /robots.txt.\n";
			exit;
		}
	}

	/**
	 * Render "AI-readable via Quoted" credit in footer.
	 *
	 * This callback is only registered on `wp_footer` when the admin has
	 * explicitly enabled the credit (Settings → Display → "Show credit in
	 * footer"). Off by default per WordPress.org Guideline 10.
	 */
	public function render_powered_by_badge() {
		echo '<div style="text-align:center;padding:10px;font-size:11px;color:#999;">';
		echo 'AI-readable via ';
		echo '<a href="https://github.com/Quangnm0208" target="_blank" rel="noopener" style="color:#666;">Quoted</a>';
		echo '</div>';
	}

	/**
	 * Add /llms.txt rewrite rule that routes to our REST endpoint.
	 */
	public function add_rewrite_rules() {
		// Accept both /llms.txt and /llms.txt/ — WP's redirect_canonical
		// adds a trailing slash whenever permalink_structure ends in one.
		add_rewrite_rule(
			'^llms\.txt/?$',
			'index.php?quoted_route=llms_txt',
			'top'
		);
	}

	public function add_query_vars( $vars ) {
		$vars[] = 'quoted_route';
		return $vars;
	}

	/**
	 * Append Quoted's AI crawler block directives to the dynamic robots.txt.
	 *
	 * WordPress emits a virtual robots.txt at /robots.txt when no static file
	 * exists. This filter runs after WP's defaults — we just concatenate our
	 * block rules at the end. Bots that respect robots.txt (most do) will
	 * stop crawling without us needing to enforce 403s.
	 *
	 * @param string $output The existing robots.txt body.
	 * @param bool   $public Whether the site's "Search engine visibility" setting allows indexing.
	 * @return string
	 */
	public function filter_robots_txt( $output, $public ) {
		if ( ! $public ) {
			// Site is set to "Discourage search engines" — WP already emits a
			// blanket Disallow; don't add anything that could confuse parsers.
			return $output;
		}
		return $output . Quoted_Bot_Detector::robots_txt_block_rules();
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
		// Short browser cache + must-revalidate, no edge cache. Avoids
		// CDN/page-cache plugins holding stale llms.txt after post edits.
		header( 'Cache-Control: public, max-age=300, must-revalidate' );
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
	 *
	 * Each candidate header is sanitized + IP-validated before use.
	 */
	private function get_client_ip() {
		$keys = array( 'REMOTE_ADDR' );
		if ( get_option( 'quoted_trust_proxy', false ) ) {
			$keys = array( 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR' );
		}
		foreach ( $keys as $key ) {
			if ( empty( $_SERVER[ $key ] ) ) {
				continue;
			}
			// $_SERVER values are attacker-controlled in proxy-trust mode.
			// Sanitize before parsing the first IP off a comma-separated list.
			$raw = sanitize_text_field( wp_unslash( $_SERVER[ $key ] ) );
			$ip  = trim( explode( ',', $raw )[0] );
			if ( filter_var( $ip, FILTER_VALIDATE_IP ) ) {
				return $ip;
			}
		}
		return '0.0.0.0';
	}
}
