<?php
/**
 * REST API routes — namespace quoted/v1.
 *
 * Endpoints:
 *  GET /wp-json/quoted/v1/llms.txt         → sitemap markdown
 *  GET /wp-json/quoted/v1/llm/(?P<slug>...) → single post markdown
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_Rest {

	public function register_routes() {
		register_rest_route( 'quoted/v1', '/llms.txt', array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => array( $this, 'serve_llms_txt' ),
			'permission_callback' => '__return_true',
		) );

		register_rest_route( 'quoted/v1', '/llm/(?P<slug>[a-zA-Z0-9-]+)', array(
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
		$content = ( new Quoted_Llms_Txt() )->get_content();
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

		$md = ( new Quoted_Markdown() )->serialize( $post );

		set_transient( $cache_key, $md, HOUR_IN_SECONDS );
		// Remember the current key so save_post can delete it later, even
		// after post_modified_gmt has changed and we can no longer derive it.
		update_post_meta( $post->ID, '_quoted_md_cache_key', $cache_key );

		$this->send_raw_markdown( $md, false );
	}

	/**
	 * Per-post markdown cache key. Tied to post_modified_gmt so a fresh edit
	 * always misses, but old keys would orphan in wp_options without an
	 * explicit save_post invalidation — see invalidate_post_cache().
	 */
	public static function cache_key_for_post( $post ) {
		return 'quoted_md_' . md5( $post->ID . '|' . $post->post_modified_gmt );
	}

	/**
	 * Delete the previously-cached markdown transient for a post.
	 *
	 * Hooked on save_post and before_delete_post by Quoted_Core. Without
	 * this, every edit creates a new transient row and the old one lives
	 * in wp_options until manually cleaned.
	 *
	 * @param int $post_id
	 */
	public static function invalidate_post_cache( $post_id ) {
		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}
		$prev_key = get_post_meta( $post_id, '_quoted_md_cache_key', true );
		if ( ! empty( $prev_key ) ) {
			delete_transient( $prev_key );
			delete_post_meta( $post_id, '_quoted_md_cache_key' );
		}
		// Also flush the llms.txt sitemap so newly-published posts appear.
		if ( class_exists( 'Quoted_Llms_Txt' ) ) {
			Quoted_Llms_Txt::flush_cache();
		}
	}

	/**
	 * Bypass WP_REST_Server's JSON serialization and emit raw markdown.
	 *
	 * WP_REST_Response with a Content-Type header is overridden by the REST
	 * server, which always serializes the body as JSON and sets
	 * Content-Type: application/json. The only way to emit raw text from a
	 * REST callback is to send headers + body ourselves and exit before the
	 * dispatcher runs its serializer.
	 *
	 * @param string    $content   Raw markdown body.
	 * @param bool|null $cache_hit True = HIT header, false = MISS, null = no header.
	 */
	private function send_raw_markdown( $content, $cache_hit ) {
		status_header( 200 );
		header( 'Content-Type: text/markdown; charset=utf-8' );
		// Short browser cache, no edge cache. Cloudflare / W3 Total Cache /
		// WP Rocket otherwise hold a stale /llms.txt for up to 24h after
		// the operator publishes new posts. 5 min is the sweet spot —
		// AI bots see fresh content fast, hosts don't get hammered.
		header( 'Cache-Control: public, max-age=300, must-revalidate' );
		header( 'X-Quoted-Version: ' . QUOTED_VERSION );
		if ( $cache_hit !== null ) {
			header( 'X-Quoted-Cache: ' . ( $cache_hit ? 'HIT' : 'MISS' ) );
		}
		echo $content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped — raw markdown body
		exit;
	}

	/**
	 * Find published post or page by slug.
	 */
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
