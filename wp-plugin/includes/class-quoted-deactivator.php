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
		wp_clear_scheduled_hook( 'quoted_cron_sync_crawls' );
		wp_clear_scheduled_hook( 'quoted_cron_sync_posts' );
		wp_clear_scheduled_hook( 'quoted_cron_refresh_token' );

		flush_rewrite_rules();
	}
}
