<?php
/**
 * Uninstall handler — fires when the user clicks "Delete" on the plugin row.
 *
 * Removes everything the plugin owns: bot log table, plugin options, and
 * transients. Idempotent and safe to run multiple times.
 *
 * @package Quoted
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

global $wpdb;

// Drop the bot log table.
$table = $wpdb->prefix . 'quoted_bot_log';
$wpdb->query( "DROP TABLE IF EXISTS $table" );

// Delete options written by this version.
$options = array(
	'quoted_version',
	'quoted_onboarded',
	'quoted_installed_at',
	'quoted_bot_allowlist',
	'quoted_schema_enabled',
	'quoted_schema_mode',
	'quoted_hash_ips',
	'quoted_disable_logging',
	'quoted_show_badge',
	'quoted_trust_proxy',
);
foreach ( $options as $opt ) {
	delete_option( $opt );
}

// Delete plugin transients.
$wpdb->query(
	"DELETE FROM {$wpdb->options}
	 WHERE option_name LIKE '_transient_quoted_%'
	    OR option_name LIKE '_transient_timeout_quoted_%'"
);

// Delete per-post markdown cache-key tracking meta.
$wpdb->query(
	"DELETE FROM {$wpdb->postmeta} WHERE meta_key = '_quoted_md_cache_key'"
);

// Defensive: clear any legacy cron hooks that earlier versions may have
// scheduled. wp_clear_scheduled_hook is a no-op when the hook isn't
// registered, so this is safe on fresh installs.
wp_clear_scheduled_hook( 'quoted_cron_license_revalidate' );
wp_clear_scheduled_hook( 'quoted_cron_sync_crawls' );
wp_clear_scheduled_hook( 'quoted_cron_sync_posts' );
wp_clear_scheduled_hook( 'quoted_cron_refresh_token' );
