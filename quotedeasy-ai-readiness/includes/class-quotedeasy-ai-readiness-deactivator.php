<?php
/**
 * Deactivation handler.
 *
 * @package QuotedEasy_AI_Readiness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class QuotedEasy_AI_Readiness_Deactivator {

	public static function deactivate() {
		wp_clear_scheduled_hook( 'quotedeasy_ai_readiness_cron_license_revalidate' );
		wp_clear_scheduled_hook( 'quotedeasy_ai_readiness_cron_sync_crawls' );
		wp_clear_scheduled_hook( 'quotedeasy_ai_readiness_cron_sync_posts' );
		wp_clear_scheduled_hook( 'quotedeasy_ai_readiness_cron_refresh_token' );

		flush_rewrite_rules();
	}
}
