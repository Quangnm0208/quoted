<?php
/**
 * Activation handler.
 *
 * Creates DB tables, sets defaults, flushes rewrite rules.
 *
 * @package QuotedEasy_AI_Readiness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class QuotedEasy_AI_Readiness_Activator {

	public static function activate( $network_wide = false ) {
		// Refuse network activation — the plugin stores per-site data
		// (wp_quotedeasy_ai_readiness_bot_log table). Trying to network-activate would create
		// the table only on the main site, leaving subsites broken.
		if ( $network_wide && function_exists( 'is_multisite' ) && is_multisite() ) {
			deactivate_plugins( plugin_basename( QUOTEDEASY_AI_READINESS_PLUGIN_FILE ) );
			wp_die(
				esc_html__( 'QuotedEasy AI Readiness does not support multisite network activation. Activate it per-site instead. The plugin stores per-site bot crawl data.', 'quotedeasy-ai-readiness' ),
				esc_html__( 'QuotedEasy AI Readiness — multisite network activation not supported', 'quotedeasy-ai-readiness' ),
				array( 'back_link' => true )
			);
		}

		// Hard requirement: DOMDocument (libxml). Used by the Markdown
		// serializer. Some minimal Docker WP images skip libxml.
		if ( ! class_exists( 'DOMDocument' ) ) {
			deactivate_plugins( plugin_basename( QUOTEDEASY_AI_READINESS_PLUGIN_FILE ) );
			wp_die(
				esc_html__( 'QuotedEasy AI Readiness requires the PHP libxml extension (the DOMDocument class). Your server is missing it. Ask your host to enable libxml-dom or install the php-xml package.', 'quotedeasy-ai-readiness' ),
				esc_html__( 'QuotedEasy AI Readiness — missing PHP extension', 'quotedeasy-ai-readiness' ),
				array( 'back_link' => true )
			);
		}

		self::create_tables();
		self::set_default_options();
		self::set_activation_redirect();

		// Record install time once — the dashboard uses it to know when the
		// "no bots after 7 days, check your firewall" advisory should fire.
		if ( ! get_option( 'quotedeasy_ai_readiness_installed_at', false ) ) {
			add_option( 'quotedeasy_ai_readiness_installed_at', time(), '', 'no' );
		}

		// Register our rewrite rule directly here so flush_rewrite_rules()
		// below persists it. The activator runs before `init`, so the
		// init-hooked QuotedEasy_AI_Readiness_Public::add_rewrite_rules() hasn't fired yet.
		// Without this, /llms.txt 404s until the operator saves Permalinks.
		add_rewrite_rule( '^llms\.txt/?$', 'index.php?quotedeasy_ai_readiness_route=llms_txt', 'top' );
		flush_rewrite_rules();
	}

	private static function create_tables() {
		global $wpdb;

		$charset_collate = $wpdb->get_charset_collate();
		$table_log = $wpdb->prefix . 'quotedeasy_ai_readiness_bot_log';

		$sql = "CREATE TABLE $table_log (
			id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			bot_name VARCHAR(64) NOT NULL,
			url_path VARCHAR(2048) NOT NULL,
			user_agent VARCHAR(512) NOT NULL,
			ip_hash CHAR(71) NOT NULL,
			crawled_at DATETIME NOT NULL,
			synced TINYINT(1) NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY idx_synced (synced, created_at),
			KEY idx_crawled (crawled_at)
		) $charset_collate;";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
	}

	private static function set_default_options() {
		$defaults = array(
			'quotedeasy_ai_readiness_version'         => QUOTEDEASY_AI_READINESS_VERSION,
			'quotedeasy_ai_readiness_onboarded'       => false,
			// AI Crawler Allowlist — empty means "all bots allowed", which is
			// the only safe default. Operator opts into blocks explicitly.
			'quotedeasy_ai_readiness_bot_allowlist'   => array(),
			// Schema engine — on by default; mode 'auto' defers Article to
			// any active SEO plugin to avoid duplicate JSON-LD.
			'quotedeasy_ai_readiness_schema_enabled'  => true,
			'quotedeasy_ai_readiness_schema_mode'     => 'auto',
			// Privacy / behaviour toggles.
			'quotedeasy_ai_readiness_hash_ips'        => true,
			'quotedeasy_ai_readiness_disable_logging' => false,
			// Credit badge: OFF by default per WordPress.org Guideline 10.
			// Operator opts in via Settings → Display.
			'quotedeasy_ai_readiness_show_badge'      => false,
			'quotedeasy_ai_readiness_trust_proxy'     => false,
		);

		foreach ( $defaults as $key => $value ) {
			if ( get_option( $key ) === false ) {
				add_option( $key, $value, '', 'no' );
			}
		}
	}

	private static function set_activation_redirect() {
		// Flag for admin redirect (consumed in QuotedEasy_AI_Readiness_Admin::maybe_redirect_to_onboarding).
		set_transient( 'quotedeasy_ai_readiness_activation_redirect', true, 30 );
	}
}
