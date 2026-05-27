<?php
/**
 * Core plugin orchestrator.
 *
 * @package QuotedEasy_AI_Readiness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class QuotedEasy_AI_Readiness_Core {

	protected $loader;

	public function __construct() {
		$this->loader = new QuotedEasy_AI_Readiness_Loader();

		$this->set_locale();
		$this->define_admin_hooks();
		$this->define_public_hooks();
		$this->define_rest_hooks();
	}

	private function set_locale() {
		$this->loader->add_action( 'init', $this, 'load_plugin_textdomain' );
	}

	public function load_plugin_textdomain() {
		load_plugin_textdomain(
			'quotedeasy-ai-readiness',
			false,
			dirname( QUOTEDEASY_AI_READINESS_PLUGIN_BASENAME ) . '/languages/'
		);
	}

	private function define_admin_hooks() {
		$admin = new QuotedEasy_AI_Readiness_Admin();

		$this->loader->add_action( 'admin_menu', $admin, 'add_menu_pages' );
		$this->loader->add_action( 'admin_enqueue_scripts', $admin, 'enqueue_assets' );
		$this->loader->add_action( 'admin_init', $admin, 'maybe_redirect_to_onboarding' );

		$this->loader->add_action( 'wp_ajax_quotedeasy_ai_readiness_sync_posts', $admin, 'ajax_sync_posts' );
		$this->loader->add_action( 'wp_ajax_quotedeasy_ai_readiness_dashboard_data', $admin, 'ajax_dashboard_data' );

		$this->loader->add_filter( 'plugin_action_links_' . QUOTEDEASY_AI_READINESS_PLUGIN_BASENAME, $admin, 'plugin_action_links' );
	}

	private function define_public_hooks() {
		$public = new QuotedEasy_AI_Readiness_Public();

		$this->loader->add_action( 'init', $public, 'detect_bot_visit', 1 );

		if ( get_option( 'quotedeasy_ai_readiness_show_badge', false ) ) {
			$this->loader->add_action( 'wp_footer', $public, 'render_powered_by_badge' );
		}

		$this->loader->add_action( 'init', $public, 'add_rewrite_rules' );
		$this->loader->add_filter( 'query_vars', $public, 'add_query_vars' );
		$this->loader->add_action( 'template_redirect', $public, 'maybe_serve_llms_txt', 1 );

		$this->loader->add_filter( 'robots_txt', $public, 'filter_robots_txt', 10, 2 );

		$schema = new QuotedEasy_AI_Readiness_Schema();
		$this->loader->add_action( 'wp_head', $schema, 'maybe_output', 20 );
	}

	private function define_rest_hooks() {
		$rest = new QuotedEasy_AI_Readiness_Rest();

		$this->loader->add_action( 'rest_api_init', $rest, 'register_routes' );

		$this->loader->add_action( 'save_post', 'QuotedEasy_AI_Readiness_Rest', 'invalidate_post_cache' );
		$this->loader->add_action( 'before_delete_post', 'QuotedEasy_AI_Readiness_Rest', 'invalidate_post_cache' );
	}

	public function run() {
		$this->loader->run();
	}
}
