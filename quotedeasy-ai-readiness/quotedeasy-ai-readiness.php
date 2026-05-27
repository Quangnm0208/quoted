<?php
/**
 * Plugin Name:       QuotedEasy AI Readiness
 * Plugin URI:        https://github.com/muahangngayvn/quotedeasy-ai-readiness
 * Description:       AI readiness layer for WordPress: generates llms.txt, serves clean Markdown content, detects AI crawlers with allow/block controls, and outputs schema signals that defer to existing SEO plugins.
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
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'QUOTEDEASY_AI_READINESS_VERSION', '0.5.2' );
define( 'QUOTEDEASY_AI_READINESS_PLUGIN_FILE', __FILE__ );
define( 'QUOTEDEASY_AI_READINESS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'QUOTEDEASY_AI_READINESS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'QUOTEDEASY_AI_READINESS_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

if ( version_compare( PHP_VERSION, '7.4', '<' ) ) {
	add_action( 'admin_notices', function () {
		echo '<div class="notice notice-error"><p>';
		echo esc_html__( 'QuotedEasy AI Readiness requires PHP 7.4 or higher.', 'quotedeasy-ai-readiness' );
		echo '</p></div>';
	} );
	return;
}

if ( version_compare( get_bloginfo( 'version' ), '6.0', '<' ) ) {
	add_action( 'admin_notices', function () {
		echo '<div class="notice notice-error"><p>';
		echo esc_html__( 'QuotedEasy AI Readiness requires WordPress 6.0 or higher.', 'quotedeasy-ai-readiness' );
		echo '</p></div>';
	} );
	return;
}

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

register_activation_hook( __FILE__, array( 'QuotedEasy_AI_Readiness_Activator', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'QuotedEasy_AI_Readiness_Deactivator', 'deactivate' ) );

function quotedeasy_ai_readiness_run() {
	$plugin = new QuotedEasy_AI_Readiness_Core();
	$plugin->run();
}
add_action( 'plugins_loaded', 'quotedeasy_ai_readiness_run', 10 );

add_action( 'admin_notices', function () {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	if ( get_option( 'permalink_structure' ) ) {
		return;
	}
	if ( get_user_meta( get_current_user_id(), 'quotedeasy_ai_readiness_permalink_notice_dismissed', true ) ) {
		return;
	}
	?>
	<div class="notice notice-warning is-dismissible" data-quotedeasy-ai-readiness-notice="permalink">
		<p>
			<strong><?php esc_html_e( 'QuotedEasy AI Readiness needs pretty permalinks', 'quotedeasy-ai-readiness' ); ?></strong>
			<?php
			printf(
				/* translators: %s: link to Settings > Permalinks */
				esc_html__( 'Your site is using Plain permalinks, so /llms.txt will 404. %s and pick any option other than Plain.', 'quotedeasy-ai-readiness' ),
				'<a href="' . esc_url( admin_url( 'options-permalink.php' ) ) . '">' . esc_html__( 'Go to Settings > Permalinks', 'quotedeasy-ai-readiness' ) . '</a>'
			);
			?>
		</p>
	</div>
	<?php
} );
