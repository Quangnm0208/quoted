<?php
/**
 * Deactivation handler.
 *
 * Clears scheduled cron events.
 * Does NOT delete data — see uninstall.php for that.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_Deactivator {

	public static function deactivate() {
		// Clear the only scheduled cron in the standalone build.
		wp_clear_scheduled_hook( 'quoted_cron_license_revalidate' );

		// Legacy hooks (pre-v0.2.0 standalone refactor) — kept in case someone
		// upgrades from a prior version. wp_clear_scheduled_hook is a no-op if
		// the hook wasn't scheduled, so it's safe.
		wp_clear_scheduled_hook( 'quoted_cron_sync_crawls' );
		wp_clear_scheduled_hook( 'quoted_cron_sync_posts' );
		wp_clear_scheduled_hook( 'quoted_cron_refresh_token' );

		flush_rewrite_rules();
	}
}
