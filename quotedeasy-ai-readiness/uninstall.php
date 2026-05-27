<?php
/**
 * Uninstall handler.
 *
 * Removes the bot log table, plugin options, transients, and post meta.
 *
 * @package QuotedEasy_AI_Readiness
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

global $wpdb;

$table = $wpdb->prefix . 'quotedeasy_ai_readiness_bot_log';
$wpdb->query( "DROP TABLE IF EXISTS $table" );

$options = array(
	'quotedeasy_ai_readiness_version',
	'quotedeasy_ai_readiness_onboarded',
	'quotedeasy_ai_readiness_installed_at',
	'quotedeasy_ai_readiness_bot_allowlist',
	'quotedeasy_ai_readiness_schema_enabled',
	'quotedeasy_ai_readiness_schema_mode',
	'quotedeasy_ai_readiness_hash_ips',
	'quotedeasy_ai_readiness_disable_logging',
	'quotedeasy_ai_readiness_show_badge',
	'quotedeasy_ai_readiness_trust_proxy',
);
foreach ( $options as $opt ) {
	delete_option( $opt );
}

$wpdb->query(
	"DELETE FROM {$wpdb->options}
	 WHERE option_name LIKE '_transient_quotedeasy_ai_readiness_%'
	    OR option_name LIKE '_transient_timeout_quotedeasy_ai_readiness_%'"
);

$wpdb->query(
	"DELETE FROM {$wpdb->postmeta} WHERE meta_key = '_quotedeasy_ai_readiness_md_cache_key'"
);

wp_clear_scheduled_hook( 'quotedeasy_ai_readiness_cron_license_revalidate' );
wp_clear_scheduled_hook( 'quotedeasy_ai_readiness_cron_sync_crawls' );
wp_clear_scheduled_hook( 'quotedeasy_ai_readiness_cron_sync_posts' );
wp_clear_scheduled_hook( 'quotedeasy_ai_readiness_cron_refresh_token' );
