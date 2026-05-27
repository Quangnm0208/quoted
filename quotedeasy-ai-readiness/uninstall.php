<?php
/**
 * Uninstall handler — fires when the user clicks "Delete" on the plugin row.
 *
 * Removes everything the plugin owns: bot log table, plugin options, and
 * transients. Idempotent and safe to run multiple times.
 *
 * @package QuotedEasy_AI_Readiness
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

global $wpdb;

// Drop the bot log table.
$table = $wpdb->prefix . 'quotedeasy_ai_readiness_bot_log';
$wpdb->query( "DROP TABLE IF EXISTS $table" );

// Delete options written by this version.
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

// Delete plugin transients.
$wpdb->query(
	"DELETE FROM {$wpdb->options}
	 WHERE option_name LIKE '_transient_quotedeasy_ai_readiness_%'
	    OR option_name LIKE '_transient_timeout_quotedeasy_ai_readiness_%'"
);

// Delete per-post markdown cache-key tracking meta.
$wpdb->query(
	"DELETE FROM {$wpdb->postmeta} WHERE meta_key = '_quotedeasy_ai_readiness_md_cache_key'"
);

// Defensive: clear any legacy cron hooks that earlier versions may have
// scheduled. wp_clear_scheduled_hook is a no-op when the hook isn't
// registered, so this is safe on fresh installs.
wp_clear_scheduled_hook( 'quotedeasy_ai_readiness_cron_license_revalidate' );
wp_clear_scheduled_hook( 'quotedeasy_ai_readiness_cron_sync_crawls' );
wp_clear_scheduled_hook( 'quotedeasy_ai_readiness_cron_sync_posts' );
wp_clear_scheduled_hook( 'quotedeasy_ai_readiness_cron_refresh_token' );
