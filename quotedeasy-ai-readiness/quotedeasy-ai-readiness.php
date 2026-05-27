<?php
/**
 * Plugin Name:       QuotedEasy AI Readiness
 * Plugin URI:        https://github.com/muahangngayvn/quotedeasy-ai-readiness
 * Description:       AI readiness layer for WordPress sites: generates llms.txt, serves clean Markdown content signals, detects AI crawlers, provides crawler allow/block controls, and outputs schema signals while respecting existing SEO plugins.
 * Version:           0.5.2
 * Requires at least: 6.0
 * Tested up to:      7.0
 * Requires PHP:      7.4
 * Author:            Quang Nguyen
 * Author URI:        https://github.com/muahangngayvn
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       quotedeasy-ai-readiness
 * Domain Path:       /languages
 *
 * @package QuotedEasy_AI_Readiness
 * @copyright 2026 Quang Nguyen
 *
 * QuotedEasy AI Readiness is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * QuotedEasy AI Readiness is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

// Prevent direct access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Plugin constants.
define( 'QUOTEDEASY_AI_READINESS_VERSION', '0.5.2' );
define( 'QUOTEDEASY_AI_READINESS_PLUGIN_FILE', __FILE__ );
define( 'QUOTEDEASY_AI_READINESS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'QUOTEDEASY_AI_READINESS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'QUOTEDEASY_AI_READINESS_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

// Minimum requirements check (graceful, no white screen).
if ( version_compare( PHP_VERSION, '7.4', '<' ) ) {
	add_action( 'admin_notices', function () {
		echo '<div class="notice notice-error"><p>';
		echo esc_html__( 'QuotedEasy AI Readiness requires PHP 7.4 or higher. Please upgrade your PHP version.', 'quotedeasy-ai-readiness' );
		echo '</p></div>';
	} );
	return;
}

if ( version_compare( get_bloginfo( 'version' ), '6.0', '<' ) ) {
	add_action( 'admin_notices', function () {
		echo '<div class="notice notice-error"><p>';
		echo esc_html__( 'QuotedEasy AI Readiness requires WordPress 6.0 or higher. Please update WordPress.', 'quotedeasy-ai-readiness' );
		echo '</p></div>';
	} );
	return;
}

/**
 * Autoload QuotedEasy AI Readiness classes.
 *
 * Follows WordPress convention: class-name.php for class Class_Name.
 * Files live in includes/, admin/, and public/.
 */
spl_autoload_register( function ( $class ) {
	if ( strpos( $class, 'QuotedEasy_AI_Readiness_' ) !== 0 ) {
		return;
	}

	$class_file = 'class-' . strtolower( str_replace( '_', '-', $class ) ) . '.php';

	$paths = array(
		QUOTEDEASY_AI_READINESS_PLUGIN_DIR . 'includes/',
		QUOTEDEASY_AI_READINESS_PLUGIN_DIR . 'admin/',
		QUOTEDEASY_AI_READINESS_PLUGIN_DIR . 'public/',
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
register_activation_hook( __FILE__, array( 'QuotedEasy_AI_Readiness_Activator', 'activate' ) );

/**
 * Deactivation hook.
 * Clears scheduled cron events. Does NOT delete data
 * (use uninstall.php for clean uninstall).
 */
register_deactivation_hook( __FILE__, array( 'QuotedEasy_AI_Readiness_Deactivator', 'deactivate' ) );

/**
 * Bootstrap plugin.
 * Lazy-loaded on `plugins_loaded` so other plugins can hook into our actions.
 */
function quotedeasy_ai_readiness_run() {
	$plugin = new QuotedEasy_AI_Readiness_Core();
	$plugin->run();
}
add_action( 'plugins_loaded', 'quotedeasy_ai_readiness_run', 10 );

/**
 * Admin notice when the site is using "Plain" permalinks.
 *
 * Pretty URLs are required for the /llms.txt rewrite rule to resolve. The
 * REST endpoint /index.php?rest_route=/quotedeasy-ai-readiness/v1/llms.txt always works as a
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
	if ( get_user_meta( get_current_user_id(), 'quotedeasy_ai_readiness_permalink_notice_dismissed', true ) ) {
		return;
	}
	?>
	<div class="notice notice-warning is-dismissible" data-quotedeasy-ai-readiness-notice="permalink">
		<p>
			<strong><?php esc_html_e( 'QuotedEasy AI Readiness needs pretty permalinks', 'quotedeasy-ai-readiness' ); ?></strong> —
			<?php
			printf(
				/* translators: %s: link to Settings → Permalinks */
				esc_html__( 'your site is currently using "Plain" permalinks (e.g. ?p=123), so the AI sitemap at /llms.txt will 404. %s and pick any option other than "Plain".', 'quotedeasy-ai-readiness' ),
				'<a href="' . esc_url( admin_url( 'options-permalink.php' ) ) . '">' . esc_html__( 'Go to Settings → Permalinks', 'quotedeasy-ai-readiness' ) . '</a>'
			);
			?>
		</p>
	</div>
	<?php
} );
