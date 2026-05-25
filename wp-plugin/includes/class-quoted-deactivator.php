<?php
/**
 * Deactivation handler.
 *
 * Flushes rewrite rules.
 * Does NOT delete data — see uninstall.php for that.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_Deactivator {

	public static function deactivate() {
		// Clear any legacy cron hooks. wp_clear_scheduled_hook is a no-op
		// when the hook isn't scheduled, so it's safe to call on a clean
		// install. These are kept for forward-compat with older versions
		// that may have scheduled them.
		wp_clear_scheduled_hook( 'quoted_cron_license_revalidate' );
		wp_clear_scheduled_hook( 'quoted_cron_sync_crawls' );
		wp_clear_scheduled_hook( 'quoted_cron_sync_posts' );
		wp_clear_scheduled_hook( 'quoted_cron_refresh_token' );

		flush_rewrite_rules();
	}
}
