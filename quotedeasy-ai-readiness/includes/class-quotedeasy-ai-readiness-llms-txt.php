<?php
/**
 * llms.txt generator.
 *
 * @package QuotedEasy_AI_Readiness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class QuotedEasy_AI_Readiness_Llms_Txt {

	const CACHE_KEY = 'quotedeasy_ai_readiness_llms_txt_v1';
	const CACHE_TTL = 300;
	const DEFAULT_POST_LIMIT = 1000;

	public function get_content() {
		$cached = get_transient( self::CACHE_KEY );
		if ( $cached !== false ) {
			return $cached;
		}

		$content = $this->generate_locally();
		set_transient( self::CACHE_KEY, $content, self::CACHE_TTL );

		return $content;
	}

	private function generate_locally() {
		$site_name = get_bloginfo( 'name' );
		$site_desc = get_bloginfo( 'description' );
		$home_url  = home_url();

		$out  = '# ' . $this->safe_md( $site_name ) . "\n\n";
		if ( ! empty( $site_desc ) ) {
			$out .= '> ' . $this->safe_md( $site_desc ) . "\n\n";
		}
		$out .= 'Site URL: ' . $home_url . "\n\n";

		/**
		 * Filter the maximum number of posts and pages listed in llms.txt.
		 *
		 * @param int $limit Default 1000. Pass -1 to include every published post.
		 */
		$limit = apply_filters( 'quotedeasy_ai_readiness_llms_txt_post_limit', self::DEFAULT_POST_LIMIT );
		$limit = is_numeric( $limit ) ? (int) $limit : self::DEFAULT_POST_LIMIT;

		$posts = get_posts( array(
			'numberposts' => $limit,
			'post_type'   => array( 'post', 'page' ),
			'post_status' => 'publish',
			'orderby'     => 'modified',
			'order'       => 'DESC',
		) );

		if ( ! empty( $posts ) ) {
			$out .= "## Content\n\n";
			foreach ( $posts as $post ) {
				$title   = $this->safe_md( $post->post_title );
				$md_url  = $this->markdown_url_for_post( $post );
				$excerpt = $this->safe_md( wp_trim_words( wp_strip_all_tags( $post->post_content ), 25, '...' ) );
				$out    .= "- [{$title}]({$md_url}): {$excerpt}\n";
			}
			$out .= "\n";
		}

		$out .= "## About\n\n";
		$out .= "This is the AI-readable sitemap for {$site_name}. ";
		$out .= "Each linked URL returns clean markdown for AI processing.\n\n";
		$out .= 'Generated on ' . gmdate( 'Y-m-d' ) . ".\n";

		return $out;
	}

	private function markdown_url_for_post( $post ) {
		return rest_url( 'quotedeasy-ai-readiness/v1/llm/' . sanitize_title( $post->post_name ) );
	}

	private function safe_md( $str ) {
		$str = wp_strip_all_tags( $str );
		$str = preg_replace( '/[\r\n]+/', ' ', $str );
		$str = trim( $str );
		$str = str_replace( array( '[', ']' ), array( '\[', '\]' ), $str );
		return $str;
	}

	public static function flush_cache() {
		delete_transient( self::CACHE_KEY );
	}
}
