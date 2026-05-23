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
	// Current (v0.2.0+).
	'quoted_version',
	'quoted_license_key',
	'quoted_license_instance_id',
	'quoted_license_status',
	'quoted_license_expires_at',
	'quoted_license_validated_at',
	'quoted_plan',
	'quoted_variant_name',
	'quoted_customer_email',
	'quoted_onboarded',
	'quoted_perplexity_api_key',
	'quoted_tavily_api_key',
	'quoted_bot_allowlist',
	'quoted_schema_enabled',
	'quoted_schema_mode',
	'quoted_hash_ips',
	'quoted_disable_logging',
	'quoted_show_badge',
	'quoted_trust_proxy',
	// Legacy (pre-standalone, in case the user is upgrading from v0.1.x).
	'quoted_backend_url',
	'quoted_jwt',
	'quoted_jwt_expires_at',
	'quoted_tenant_id',
	'quoted_niche',
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

// Delete per-post markdown cache-key tracking meta.
$wpdb->query(
	"DELETE FROM {$wpdb->postmeta} WHERE meta_key = '_quoted_md_cache_key'"
);

// Clear any scheduled crons (defensive — deactivation should already have).
wp_clear_scheduled_hook( 'quoted_cron_license_revalidate' );
// Legacy hooks from the pre-standalone backend-sync architecture.
wp_clear_scheduled_hook( 'quoted_cron_sync_crawls' );
wp_clear_scheduled_hook( 'quoted_cron_sync_posts' );
wp_clear_scheduled_hook( 'quoted_cron_refresh_token' );
