<?php
/**
 * Plugin Name:       Quoted — Make your site AI-readable
 * Plugin URI:        https://github.com/muahangngayvn/quoted
 * Description:       AI-readability layer for WordPress: auto-generates llms.txt, serves clean Markdown per post, detects 60+ AI bots (ChatGPT, Claude, Perplexity, Gemini), and lets you allow or block each one. Adds Article + FAQPage JSON-LD that defers to Yoast / Rank Math / AIOSEO when they are active.
 * Version:           0.5.0
 * Requires at least: 6.0
 * Tested up to:      6.8
 * Requires PHP:      7.4
 * Author:            Quang Nguyen
 * Author URI:        https://github.com/muahangngayvn
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       quoted
 * Domain Path:       /languages
 * Network:           false
 * Update URI:        false
 *
 * @package Quoted
 * @copyright 2026 Quang Nguyen
 *
 * Quoted is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * Quoted is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

// Prevent direct access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Plugin constants.
define( 'QUOTED_VERSION', '0.5.0' );
define( 'QUOTED_PLUGIN_FILE', __FILE__ );
define( 'QUOTED_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'QUOTED_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'QUOTED_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

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
 * Creates DB tables, sets default options, flushes rewrite rules.
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

/**
 * Admin notice when the site is using "Plain" permalinks.
 *
 * Pretty URLs are required for the /llms.txt rewrite rule to resolve. The
 * REST endpoint /index.php?rest_route=/quoted/v1/llms.txt always works as a
 * fallback, but most operators expect /llms.txt to be a clean URL — that's
 * the whole reason the spec exists. This nudges them to flip the setting.
 */
add_action( 'admin_notices', function () {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	if ( get_option( 'permalink_structure' ) ) {
		return; // pretty permalinks already set
	}
	// Dismissable per-user.
	if ( get_user_meta( get_current_user_id(), 'quoted_permalink_notice_dismissed', true ) ) {
		return;
	}
	?>
	<div class="notice notice-warning is-dismissible" data-quoted-notice="permalink">
		<p>
			<strong><?php esc_html_e( 'Quoted needs pretty permalinks', 'quoted' ); ?></strong> —
			<?php
			printf(
				/* translators: %s: link to Settings → Permalinks */
				esc_html__( 'your site is currently using "Plain" permalinks (e.g. ?p=123), so the AI sitemap at /llms.txt will 404. %s and pick any option other than "Plain".', 'quoted' ),
				'<a href="' . esc_url( admin_url( 'options-permalink.php' ) ) . '">' . esc_html__( 'Go to Settings → Permalinks', 'quoted' ) . '</a>'
			);
			?>
		</p>
	</div>
	<?php
} );
