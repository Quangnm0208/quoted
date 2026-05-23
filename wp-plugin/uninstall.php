<?php
/**
 * Uninstall handler — fired when user clicks "Delete" on the plugin row.
 *
 * Removes ALL plugin data: options, DB tables, transients.
 * Does NOT call the backend to delete the tenant (operator responsibility).
 *
 * @package Quoted
 */

// If uninstall not called from WordPress, exit.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Drop custom table.
global $wpdb;
$table = $wpdb->prefix . 'quoted_bot_log';
$wpdb->query( "DROP TABLE IF EXISTS $table" );

// Delete options.
$options = array(
	'quoted_version',
	'quoted_backend_url',
	'quoted_license_key',
	'quoted_jwt',
	'quoted_jwt_expires_at',
	'quoted_tenant_id',
	'quoted_plan',
	'quoted_niche',
	'quoted_onboarded',
	'quoted_hash_ips',
	'quoted_disable_logging',
	'quoted_show_badge',
);

foreach ( $options as $opt ) {
	delete_option( $opt );
}

// Delete all our transients (any cached markdown).
$wpdb->query(
	"DELETE FROM {$wpdb->options} 
	 WHERE option_name LIKE '_transient_quoted_%' 
	    OR option_name LIKE '_transient_timeout_quoted_%'"
);

// Clear any scheduled crons (defensive — deactivation should already have).
wp_clear_scheduled_hook( 'quoted_cron_sync_crawls' );
wp_clear_scheduled_hook( 'quoted_cron_sync_posts' );
wp_clear_scheduled_hook( 'quoted_cron_refresh_token' );
