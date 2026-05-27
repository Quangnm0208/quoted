<?php
/**
 * REST API routes under the quotedeasy-ai-readiness/v1 namespace.
 *
 * @package QuotedEasy_AI_Readiness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class QuotedEasy_AI_Readiness_Rest {

	public function register_routes() {
		register_rest_route( 'quotedeasy-ai-readiness/v1', '/llms.txt', array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => array( $this, 'serve_llms_txt' ),
			'permission_callback' => '__return_true',
		) );

		register_rest_route( 'quotedeasy-ai-readiness/v1', '/llm/(?P<slug>[a-zA-Z0-9-]+)', array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => array( $this, 'serve_post_markdown' ),
			'permission_callback' => '__return_true',
			'args'                => array(
				'slug' => array(
					'sanitize_callback' => 'sanitize_title',
					'validate_callback' => function ( $value ) {
						return is_string( $value ) && strlen( $value ) > 0 && strlen( $value ) <= 200;
					},
				),
			),
		) );
	}

	public function serve_llms_txt( $request ) {
		$content = ( new QuotedEasy_AI_Readiness_Llms_Txt() )->get_content();
		$this->send_raw_markdown( $content, null );
	}

	public function serve_post_markdown( $request ) {
		$slug = $request->get_param( 'slug' );
		$post = $this->find_post_by_slug( $slug );

		if ( ! $post ) {
			return new WP_Error(
				'not_found',
				__( 'Post not found.', 'quotedeasy-ai-readiness' ),
				array( 'status' => 404 )
			);
		}

		$cache_key = self::cache_key_for_post( $post );
		$cached    = get_transient( $cache_key );

		if ( $cached !== false ) {
			$this->send_raw_markdown( $cached, true );
		}

		$md = ( new QuotedEasy_AI_Readiness_Markdown() )->serialize( $post );

		set_transient( $cache_key, $md, HOUR_IN_SECONDS );
		update_post_meta( $post->ID, '_quotedeasy_ai_readiness_md_cache_key', $cache_key );

		$this->send_raw_markdown( $md, false );
	}

	public static function cache_key_for_post( $post ) {
		return 'quotedeasy_ai_readiness_md_' . md5( $post->ID . '|' . $post->post_modified_gmt );
	}

	public static function invalidate_post_cache( $post_id ) {
		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}
		$prev_key = get_post_meta( $post_id, '_quotedeasy_ai_readiness_md_cache_key', true );
		if ( ! empty( $prev_key ) ) {
			delete_transient( $prev_key );
			delete_post_meta( $post_id, '_quotedeasy_ai_readiness_md_cache_key' );
		}
		if ( class_exists( 'QuotedEasy_AI_Readiness_Llms_Txt' ) ) {
			QuotedEasy_AI_Readiness_Llms_Txt::flush_cache();
		}
	}

	private function send_raw_markdown( $content, $cache_hit ) {
		status_header( 200 );
		header( 'Content-Type: text/markdown; charset=utf-8' );
		header( 'Cache-Control: public, max-age=300, must-revalidate' );
		header( 'X-QuotedEasy-Version: ' . QUOTEDEASY_AI_READINESS_VERSION );
		if ( $cache_hit !== null ) {
			header( 'X-QuotedEasy-Cache: ' . ( $cache_hit ? 'HIT' : 'MISS' ) );
		}
		echo $content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		exit;
	}

	private function find_post_by_slug( $slug ) {
		$post = get_page_by_path( $slug, OBJECT, 'post' );
		if ( $post && $post->post_status === 'publish' ) {
			return $post;
		}

		$page = get_page_by_path( $slug, OBJECT, 'page' );
		if ( $page && $page->post_status === 'publish' ) {
			return $page;
		}

		return null;
	}
}
