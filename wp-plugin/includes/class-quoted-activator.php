<?php
/**
 * Activation handler.
 *
 * Creates DB tables, schedules cron, sets defaults.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_Activator {

	public static function activate() {
		self::create_tables();
		self::set_default_options();
		self::schedule_cron();
		self::set_activation_redirect();

		// Flush rewrite rules so /llms.txt routes correctly.
		// Cheap on activation, never call this elsewhere.
		flush_rewrite_rules();
	}

	private static function create_tables() {
		global $wpdb;

		$charset_collate = $wpdb->get_charset_collate();
		$table_log = $wpdb->prefix . 'quoted_bot_log';

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
			'quoted_version'         => QUOTED_VERSION,
			'quoted_backend_url'     => '',
			'quoted_license_key'     => '',
			'quoted_jwt'             => '',
			'quoted_jwt_expires_at'  => 0,
			'quoted_tenant_id'       => '',
			'quoted_plan'            => 'free',
			'quoted_niche'           => '',
			'quoted_onboarded'       => false,
			'quoted_hash_ips'        => true,
			'quoted_disable_logging' => false,
			'quoted_show_badge'      => true,
			'quoted_trust_proxy'     => false,
		);

		foreach ( $defaults as $key => $value ) {
			if ( get_option( $key ) === false ) {
				add_option( $key, $value );
			}
		}
	}

	private static function schedule_cron() {
		if ( ! wp_next_scheduled( 'quoted_cron_sync_crawls' ) ) {
			wp_schedule_event( time() + 300, 'hourly', 'quoted_cron_sync_crawls' );
		}
		if ( ! wp_next_scheduled( 'quoted_cron_sync_posts' ) ) {
			wp_schedule_event( time() + 600, 'twicedaily', 'quoted_cron_sync_posts' );
		}
		if ( ! wp_next_scheduled( 'quoted_cron_refresh_token' ) ) {
			wp_schedule_event( time() + 3600, 'hourly', 'quoted_cron_refresh_token' );
		}
	}

	private static function set_activation_redirect() {
		// Flag for admin redirect (consumed in Quoted_Admin::maybe_redirect_to_onboarding).
		set_transient( 'quoted_activation_redirect', true, 30 );
	}
}
