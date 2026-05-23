<?php
/**
 * Plugin Name:       Quoted — AI Citation Tracker
 * Plugin URI:        https://quoted.io
 * Description:       Make your WordPress site AI-readable. Track when ChatGPT, Claude, Perplexity, and Google AI cite your content.
 * Version:           0.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Nguyễn Mạnh Quang
 * Author URI:        mailto:quangnm0208@gmail.com
 * License:           Proprietary
 * Text Domain:       quoted
 * Domain Path:       /languages
 *
 * @package Quoted
 * @copyright 2026 Nguyễn Mạnh Quang. All rights reserved.
 */

// Prevent direct access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Plugin constants.
define( 'QUOTED_VERSION', '0.1.0' );
define( 'QUOTED_PLUGIN_FILE', __FILE__ );
define( 'QUOTED_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'QUOTED_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'QUOTED_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

// Lemon Squeezy store + variant IDs.
// REPLACE these placeholders with real values after creating the LS store
// + Solo / Pro+ product variants. Each variant's "Share" tab gives the
// /buy/<uuid> URL — copy the UUID portion into the matching constant.
define( 'QUOTED_LS_STORE_SLUG',          'YOUR-LS-STORE-SLUG' );        // e.g. 'quoted'
define( 'QUOTED_LS_VARIANT_SOLO',        'PLACEHOLDER-SOLO-VARIANT' );  // e.g. '12345' or UUID
define( 'QUOTED_LS_VARIANT_PRO_PLUS',    'PLACEHOLDER-PROPLUS-VARIANT' );
define( 'QUOTED_LS_CUSTOMER_PORTAL_URL', 'https://app.lemonsqueezy.com/my-orders' ); // global LS portal

// Minimum requirements check (graceful, no white screen).
if ( version_compare( PHP_VERSION, '7.4', '<' ) ) {
	add_action( 'admin_notices', function () {
		echo '<div class="notice notice-error"><p>';
		echo esc_html__( 'Quoted requires PHP 7.4 or higher. Please upgrade your PHP version.', 'quoted' );
		echo '</p></div>';
	} );
	return;
}

if ( version_compare( get_bloginfo( 'version' ), '6.0', '<' ) ) {
	add_action( 'admin_notices', function () {
		echo '<div class="notice notice-error"><p>';
		echo esc_html__( 'Quoted requires WordPress 6.0 or higher. Please update WordPress.', 'quoted' );
		echo '</p></div>';
	} );
	return;
}

/**
 * Autoload Quoted classes.
 *
 * Follows WordPress convention: class-name.php for class Class_Name.
 * Files live in includes/, admin/, and public/.
 */
spl_autoload_register( function ( $class ) {
	if ( strpos( $class, 'Quoted_' ) !== 0 ) {
		return;
	}

	$class_file = 'class-' . strtolower( str_replace( '_', '-', $class ) ) . '.php';

	$paths = array(
		QUOTED_PLUGIN_DIR . 'includes/',
		QUOTED_PLUGIN_DIR . 'admin/',
		QUOTED_PLUGIN_DIR . 'public/',
	);

	foreach ( $paths as $path ) {
		$file = $path . $class_file;
		if ( file_exists( $file ) ) {
			require_once $file;
			return;
		}
	}
} );

/**
 * Activation hook.
 * Creates DB tables, schedules cron, sets default options.
 */
register_activation_hook( __FILE__, array( 'Quoted_Activator', 'activate' ) );

/**
 * Deactivation hook.
 * Clears scheduled cron events. Does NOT delete data
 * (use uninstall.php for clean uninstall).
 */
register_deactivation_hook( __FILE__, array( 'Quoted_Deactivator', 'deactivate' ) );

/**
 * Bootstrap plugin.
 * Lazy-loaded on `plugins_loaded` so other plugins can hook into our actions.
 */
function quoted_run() {
	$plugin = new Quoted_Core();
	$plugin->run();
}
add_action( 'plugins_loaded', 'quoted_run', 10 );
