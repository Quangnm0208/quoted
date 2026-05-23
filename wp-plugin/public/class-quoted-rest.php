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
		$llms = new Quoted_Llms_Txt();
		$content = $llms->get_content();

		return new WP_REST_Response( $content, 200, array(
			'Content-Type'    => 'text/markdown; charset=utf-8',
			'Cache-Control'   => 'public, max-age=300, s-maxage=86400',
			'X-Quoted-Version' => QUOTED_VERSION,
		) );
	}

	public function serve_post_markdown( $request ) {
		$slug = $request->get_param( 'slug' );

		$post = $this->find_post_by_slug( $slug );

		if ( ! $post ) {
			return new WP_Error(
				'not_found',
				__( 'Post not found.', 'quoted' ),
				array( 'status' => 404 )
			);
		}

		// Cache key tied to post's modified_gmt so updates invalidate.
		$cache_key = 'quoted_md_' . md5( $post->ID . '|' . $post->post_modified_gmt );
		$cached = get_transient( $cache_key );

		if ( $cached !== false ) {
			return new WP_REST_Response( $cached, 200, array(
				'Content-Type'    => 'text/markdown; charset=utf-8',
				'Cache-Control'   => 'public, max-age=300, s-maxage=86400',
				'X-Quoted-Version' => QUOTED_VERSION,
				'X-Quoted-Cache'  => 'HIT',
			) );
		}

		$md = ( new Quoted_Markdown() )->serialize( $post );

		// 1-hour transient (post modification flushes via key).
		set_transient( $cache_key, $md, 3600 );

		return new WP_REST_Response( $md, 200, array(
			'Content-Type'    => 'text/markdown; charset=utf-8',
			'Cache-Control'   => 'public, max-age=300, s-maxage=86400',
			'X-Quoted-Version' => QUOTED_VERSION,
			'X-Quoted-Cache'  => 'MISS',
		) );
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
