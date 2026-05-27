<?php
/**
 * Schema Engine — outputs JSON-LD on the frontend.
 *
 * QuotedEasy AI Readiness ships two schema types:
 *   - Article (on every single post/page)
 *   - FAQPage (auto-detected from [faq] shortcodes or H2/H3 question patterns)
 *
 * Designed to coexist with Yoast / Rank Math / AIOSEO / SEOPress. When the
 * "Schema mode" setting is 'auto' (the default), we detect those SEO plugins
 * and defer the Article schema to them — but always emit the FAQ schema we
 * generate from shortcodes, because most SEO plugins don't pick those up
 * unless their FAQ block is used.
 *
 * @package QuotedEasy_AI_Readiness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class QuotedEasy_AI_Readiness_Schema {

	/**
	 * SEO plugins that already emit Article/Person/Organization schema. When
	 * any of these are active AND the schema_mode is 'auto', we skip Article
	 * to avoid duplicate JSON-LD warnings in Google Rich Results test.
	 */
	private static function conflicting_plugins() {
		return array(
			// Big four.
			'wordpress-seo/wp-seo.php'                          => 'Yoast SEO',
			'wordpress-seo-premium/wp-seo-premium.php'          => 'Yoast SEO Premium',
			'seo-by-rank-math/rank-math.php'                    => 'Rank Math SEO',
			'seo-by-rank-math-pro/rank-math-pro.php'            => 'Rank Math SEO Pro',
			'all-in-one-seo-pack/all_in_one_seo_pack.php'       => 'All in One SEO',
			'all-in-one-seo-pack-pro/all_in_one_seo_pack.php'   => 'All in One SEO Pro',
			'wp-seopress/seopress.php'                          => 'SEOPress',
			'wp-seopress-pro/seopress-pro.php'                  => 'SEOPress Pro',
			// Smaller but real install bases that also emit Article/FAQ schema.
			'slim-seo/slim-seo.php'                             => 'Slim SEO',
			'autodescription/autodescription.php'               => 'The SEO Framework',
			'squirrly-seo/squirrly.php'                         => 'Squirrly SEO',
			'wp-meta-seo/wp-meta-seo.php'                       => 'WP Meta SEO',
			'schema/schema.php'                                 => 'Schema',
			'schema-pro/schema-pro.php'                         => 'Schema Pro',
			'wp-schema-pro/wp-schema-pro.php'                   => 'Schema Pro',
			'schema-and-structured-data-for-wp/structured-data-for-wp.php' => 'Schema & Structured Data for WP',
		);
	}

	/**
	 * Plugin slug of the first active conflicting SEO plugin, or null.
	 */
	public static function conflicting_seo_plugin() {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		foreach ( self::conflicting_plugins() as $slug => $name ) {
			if ( is_plugin_active( $slug ) ) {
				return $name;
			}
		}
		return null;
	}

	/**
	 * Print all enabled schema blocks for the current request.
	 *
	 * Hooked on wp_head. Bails on archives, search, 404, feeds — schema only
	 * makes sense on a real content URL.
	 */
	public function maybe_output() {
		if ( ! get_option( 'quotedeasy_ai_readiness_schema_enabled', true ) ) {
			return;
		}
		if ( is_feed() || is_404() || is_search() || ! is_singular() ) {
			return;
		}

		$post = get_post();
		if ( ! $post || $post->post_status !== 'publish' ) {
			return;
		}

		$mode = get_option( 'quotedeasy_ai_readiness_schema_mode', 'auto' );

		// Article — skip in auto mode if an SEO plugin already provides it.
		$emit_article = true;
		if ( $mode === 'auto' && self::conflicting_seo_plugin() ) {
			$emit_article = false;
		}
		if ( $mode === 'never' ) {
			$emit_article = false;
		}

		if ( $emit_article ) {
			$this->print_jsonld( $this->build_article_schema( $post ), 'article' );
		}

		// FAQ — emit whenever questions are detected, regardless of SEO plugin.
		// Most SEO plugins only pick up their own FAQ block; shortcode-based
		// FAQ plugins (Easy FAQ, Quick & Easy FAQs, "[faq][/faq]" pairs) and
		// heuristic H2-question patterns are usually missed.
		$faq = $this->extract_faqs( $post );
		if ( ! empty( $faq ) ) {
			$this->print_jsonld( $this->build_faq_schema( $faq ), 'faq' );
		}
	}

	/**
	 * Compact JSON-LD <script> emitter.
	 */
	private function print_jsonld( $data, $tag ) {
		if ( empty( $data ) ) {
			return;
		}
		$data = apply_filters( 'quotedeasy_ai_readiness_schema_' . $tag, $data );
		// JSON_HEX_* flags hex-encode <, >, &, ', " inside the script body. Without them
		// a literal "</script>" in any field (title, FAQ Q/A) would close the JSON-LD
		// script tag and let following content execute. These four flags are the
		// WordPress hardening standard for inline JSON in <script> contexts.
		$flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
			| JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT;
		echo "\n<script type=\"application/ld+json\" data-emitter=\"quotedeasy-ai-readiness-" . esc_attr( $tag ) . "\">";
		echo wp_json_encode( $data, $flags );
		echo "</script>\n";
	}

	/**
	 * Build the Article (or BlogPosting for blog posts) schema.
	 */
	private function build_article_schema( $post ) {
		$type = ( $post->post_type === 'post' ) ? 'BlogPosting' : 'Article';

		$author_id   = (int) $post->post_author;
		$author_name = get_the_author_meta( 'display_name', $author_id );
		$author_url  = get_author_posts_url( $author_id );

		$schema = array(
			'@context'      => 'https://schema.org',
			'@type'         => $type,
			'headline'      => wp_strip_all_tags( get_the_title( $post ) ),
			'datePublished' => get_the_date( 'c', $post ),
			'dateModified'  => get_the_modified_date( 'c', $post ),
			'author'        => array(
				'@type' => 'Person',
				'name'  => $author_name,
				'url'   => $author_url,
			),
			'publisher'     => $this->build_publisher(),
			'mainEntityOfPage' => array(
				'@type' => 'WebPage',
				'@id'   => get_permalink( $post ),
			),
		);

		$excerpt = wp_strip_all_tags( get_the_excerpt( $post ) );
		if ( $excerpt ) {
			$schema['description'] = wp_trim_words( $excerpt, 40 );
		}

		$thumb_id = get_post_thumbnail_id( $post );
		if ( $thumb_id ) {
			$src = wp_get_attachment_image_src( $thumb_id, 'full' );
			if ( $src && ! empty( $src[0] ) ) {
				$schema['image'] = $src[0];
			}
		}

		// Word count helps engines decide if a page is substantive.
		$content = wp_strip_all_tags( strip_shortcodes( $post->post_content ) );
		$schema['wordCount'] = str_word_count( $content );

		return $schema;
	}

	/**
	 * Publisher block reused inside Article. Site name + logo if present.
	 */
	private function build_publisher() {
		$publisher = array(
			'@type' => 'Organization',
			'name'  => get_bloginfo( 'name' ),
			'url'   => home_url(),
		);

		// Custom logo (Customizer → Site Identity) if set.
		$logo_id = get_theme_mod( 'custom_logo' );
		if ( $logo_id ) {
			$src = wp_get_attachment_image_src( $logo_id, 'full' );
			if ( $src && ! empty( $src[0] ) ) {
				$publisher['logo'] = array(
					'@type' => 'ImageObject',
					'url'   => $src[0],
				);
			}
		}

		return $publisher;
	}

	/**
	 * Extract FAQ question/answer pairs from a post.
	 *
	 * Two detection strategies, in order:
	 *
	 *   1. Shortcode pairs `[faq]Q[/faq]A` and `[faq_item question="…"]A[/faq_item]`
	 *      — the common output of "Easy FAQ", "Quick & Easy FAQs", and similar.
	 *
	 *   2. Heuristic: H2 / H3 headings that end in '?' followed by paragraph
	 *      content up to the next heading. Works on hand-written posts.
	 *
	 * Returns an array of [ ['q' => '…', 'a' => '…'], … ] or empty array.
	 */
	private function extract_faqs( $post ) {
		// Per-post cache. do_blocks() and the regex pass below are not free
		// on long-form articles; without this, every page view of a post
		// re-runs the whole thing. Invalidated by save_post via the existing
		// QuotedEasy_AI_Readiness_Rest::invalidate_post_cache() hook (it also drops the
		// per-post markdown transient, so the cycle is one delete_post_meta).
		static $request_cache = array();
		if ( isset( $request_cache[ $post->ID ] ) ) {
			return $request_cache[ $post->ID ];
		}

		$cache_key = 'quotedeasy_ai_readiness_faqs_' . md5( $post->ID . '|' . $post->post_modified_gmt );
		$cached    = get_transient( $cache_key );
		if ( is_array( $cached ) ) {
			$request_cache[ $post->ID ] = $cached;
			return $cached;
		}

		$content = $post->post_content;
		$pairs   = array();

		// Strategy 1 — [faq_item question="…"]Answer[/faq_item]
		if ( preg_match_all( '/\[faq_item\s+question="([^"]+)"\]([\s\S]*?)\[\/faq_item\]/i', $content, $m ) ) {
			$count = count( $m[1] );
			for ( $i = 0; $i < $count; $i++ ) {
				$pairs[] = array(
					'q' => trim( wp_strip_all_tags( $m[1][ $i ] ) ),
					'a' => trim( wp_strip_all_tags( do_shortcode( $m[2][ $i ] ) ) ),
				);
			}
		}

		// Strategy 2 — H2/H3 ending in "?" followed by content.
		if ( empty( $pairs ) ) {
			$expanded = function_exists( 'do_blocks' ) ? do_blocks( $content ) : $content;
			if ( preg_match_all( '#<h[23][^>]*>([^<]*\?)\s*</h[23]>([\s\S]*?)(?=<h[23][^>]*>|$)#i', $expanded, $m ) ) {
				$count = count( $m[1] );
				for ( $i = 0; $i < $count; $i++ ) {
					$q = trim( wp_strip_all_tags( $m[1][ $i ] ) );
					$a = trim( wp_strip_all_tags( $m[2][ $i ] ) );
					if ( $q && $a && strlen( $a ) > 10 ) {
						$pairs[] = array( 'q' => $q, 'a' => $a );
					}
				}
			}
		}

		// Cap at 20 pairs — Google ignores FAQ schema beyond that anyway.
		if ( count( $pairs ) > 20 ) {
			$pairs = array_slice( $pairs, 0, 20 );
		}

		// Cache for 12h. The save_post hook will short-circuit it sooner.
		set_transient( $cache_key, $pairs, 12 * HOUR_IN_SECONDS );
		$request_cache[ $post->ID ] = $pairs;
		return $pairs;
	}

	/**
	 * Wrap extracted Q&A pairs in FAQPage schema.org JSON.
	 */
	private function build_faq_schema( $pairs ) {
		$main = array();
		foreach ( $pairs as $p ) {
			$main[] = array(
				'@type'          => 'Question',
				'name'           => $p['q'],
				'acceptedAnswer' => array(
					'@type' => 'Answer',
					'text'  => $p['a'],
				),
			);
		}
		return array(
			'@context'   => 'https://schema.org',
			'@type'      => 'FAQPage',
			'mainEntity' => $main,
		);
	}
}
