<?php
/**
 * Markdown serializer — converts WP post HTML to clean markdown.
 *
 * Strategy: minimal DOM walk. No external library to keep plugin lean.
 * Handles common WP/Gutenberg patterns.
 *
 * Strips: script, style, iframe, nav, footer, aside, form.
 * Preserves: headings, paragraphs, lists, links, images, code, blockquote.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_Markdown {

	/**
	 * Convert a post object to markdown.
	 *
	 * @param WP_Post $post
	 * @return string
	 */
	public function serialize( $post ) {
		$out  = "# " . $this->escape( $post->post_title ) . "\n\n";

		// Frontmatter-ish metadata.
		$out .= "Author: " . get_the_author_meta( 'display_name', $post->post_author ) . "\n";
		$out .= "Published: " . get_the_date( 'Y-m-d', $post ) . "\n";
		$modified = get_the_modified_date( 'Y-m-d', $post );
		if ( $modified !== get_the_date( 'Y-m-d', $post ) ) {
			$out .= "Updated: " . $modified . "\n";
		}
		$out .= "Canonical: " . get_permalink( $post ) . "\n";

		$categories = wp_get_post_categories( $post->ID, array( 'fields' => 'names' ) );
		if ( ! empty( $categories ) ) {
			$out .= "Categories: " . implode( ', ', array_map( array( $this, 'escape' ), $categories ) ) . "\n";
		}

		$out .= "\n---\n\n";

		// Content body. Avoid apply_filters('the_content', ...) — that fires
		// every third-party content filter (Jetpack, Yoast, embed handlers,
		// oEmbed remote fetches, arbitrary shortcodes hitting external APIs),
		// any of which can be slow or output script tags that survive the
		// DOMDocument parser. Expand Gutenberg blocks + paragraphs + entities
		// directly, then strip shortcodes whose output we cannot vouch for.
		$content = $post->post_content;
		if ( function_exists( 'do_blocks' ) ) {
			$content = do_blocks( $content );
		}
		$content = strip_shortcodes( $content );
		$content = wptexturize( $content );
		$content = convert_smilies( $content );
		$content = wpautop( $content );

		$out .= $this->html_to_markdown( $content );

		return $out;
	}

	/**
	 * Convert HTML to markdown.
	 *
	 * Uses DOMDocument for parsing. Not perfect on malformed HTML but acceptable.
	 */
	public function html_to_markdown( $html ) {
		if ( empty( trim( $html ) ) ) {
			return '';
		}

		// Wrap in body for stable parsing.
		$wrapped = '<!DOCTYPE html><html><body>' . $html . '</body></html>';

		libxml_use_internal_errors( true );
		$dom = new DOMDocument( '1.0', 'UTF-8' );
		// Force UTF-8 interpretation.
		$dom->loadHTML( '<?xml encoding="UTF-8">' . $wrapped, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD );
		libxml_clear_errors();

		// Remove tags we never want.
		$strip_tags = array( 'script', 'style', 'iframe', 'nav', 'footer', 'aside', 'form', 'noscript', 'svg' );
		foreach ( $strip_tags as $tag ) {
			$nodes = $dom->getElementsByTagName( $tag );
			while ( $nodes->length > 0 ) {
				$node = $nodes->item( 0 );
				if ( $node && $node->parentNode ) {
					$node->parentNode->removeChild( $node );
				}
			}
		}

		$body = $dom->getElementsByTagName( 'body' )->item( 0 );
		if ( ! $body ) {
			return '';
		}

		$md = $this->walk( $body );

		// Collapse triple newlines.
		$md = preg_replace( "/\n{3,}/", "\n\n", $md );
		return trim( $md ) . "\n";
	}

	/**
	 * Recursive node walker.
	 *
	 * @param DOMNode $node
	 * @return string
	 */
	private function walk( $node ) {
		if ( $node->nodeType === XML_TEXT_NODE ) {
			return $this->escape_text( $node->nodeValue );
		}

		if ( $node->nodeType !== XML_ELEMENT_NODE ) {
			return '';
		}

		$tag = strtolower( $node->nodeName );
		$inner = $this->walk_children( $node );

		switch ( $tag ) {
			case 'h1': return "\n# " . trim( $inner ) . "\n\n";
			case 'h2': return "\n## " . trim( $inner ) . "\n\n";
			case 'h3': return "\n### " . trim( $inner ) . "\n\n";
			case 'h4': return "\n#### " . trim( $inner ) . "\n\n";
			case 'h5': return "\n##### " . trim( $inner ) . "\n\n";
			case 'h6': return "\n###### " . trim( $inner ) . "\n\n";

			case 'p':
				return "\n" . trim( $inner ) . "\n\n";

			case 'br':
				return "\n";

			case 'strong':
			case 'b':
				return '**' . $inner . '**';

			case 'em':
			case 'i':
				return '*' . $inner . '*';

			case 'code':
				// Inline code only (block-level <pre><code> handled below).
				return '`' . $inner . '`';

			case 'pre':
				$lang = '';
				$code_node = $this->find_child( $node, 'code' );
				if ( $code_node ) {
					$class = $code_node->getAttribute( 'class' );
					if ( preg_match( '/language-([a-z0-9]+)/', $class, $m ) ) {
						$lang = $m[1];
					}
					$inner = $code_node->textContent;
				}
				return "\n```{$lang}\n" . $inner . "\n```\n\n";

			case 'a':
				$href = $node->getAttribute( 'href' );
				if ( empty( $href ) ) {
					return $inner;
				}
				return '[' . $inner . '](' . esc_url_raw( $href ) . ')';

			case 'img':
				$src = $node->getAttribute( 'src' );
				$alt = $node->getAttribute( 'alt' );
				if ( empty( $src ) ) {
					return '';
				}
				return '![' . $this->escape( $alt ) . '](' . esc_url_raw( $src ) . ')';

			case 'ul':
				return "\n" . $this->walk_list( $node, false ) . "\n";

			case 'ol':
				return "\n" . $this->walk_list( $node, true ) . "\n";

			case 'blockquote':
				$lines = explode( "\n", trim( $inner ) );
				$lines = array_map( function ( $l ) { return '> ' . $l; }, $lines );
				return "\n" . implode( "\n", $lines ) . "\n\n";

			case 'hr':
				return "\n---\n\n";

			case 'table':
				return $this->walk_table( $node );

			// Pass-through containers.
			case 'div':
			case 'section':
			case 'article':
			case 'main':
			case 'span':
			case 'figure':
			case 'figcaption':
			case 'body':
			case 'html':
				return $inner;

			default:
				return $inner;
		}
	}

	private function walk_children( $node ) {
		$out = '';
		foreach ( $node->childNodes as $child ) {
			$out .= $this->walk( $child );
		}
		return $out;
	}

	private function walk_list( $node, $ordered ) {
		$lines = array();
		$idx = 1;
		foreach ( $node->childNodes as $li ) {
			if ( $li->nodeType !== XML_ELEMENT_NODE || strtolower( $li->nodeName ) !== 'li' ) {
				continue;
			}
			$prefix = $ordered ? ( $idx++ . '. ' ) : '- ';
			$item_md = trim( $this->walk_children( $li ) );
			// Indent multi-line items by 2 spaces (markdown list continuation).
			$item_md = preg_replace( "/\n/", "\n  ", $item_md );
			$lines[] = $prefix . $item_md;
		}
		return implode( "\n", $lines );
	}

	private function walk_table( $node ) {
		$rows = array();
		$header_done = false;

		foreach ( $node->getElementsByTagName( 'tr' ) as $tr ) {
			$cells = array();
			$is_header = false;

			foreach ( $tr->childNodes as $cell ) {
				if ( $cell->nodeType !== XML_ELEMENT_NODE ) continue;
				$tag = strtolower( $cell->nodeName );
				if ( $tag === 'th' ) $is_header = true;
				if ( $tag === 'th' || $tag === 'td' ) {
					$cells[] = trim( preg_replace( "/\s+/", ' ', $this->walk_children( $cell ) ) );
				}
			}

			if ( empty( $cells ) ) continue;
			$rows[] = '| ' . implode( ' | ', $cells ) . ' |';

			if ( $is_header && ! $header_done ) {
				$rows[] = '|' . str_repeat( ' --- |', count( $cells ) );
				$header_done = true;
			}
		}

		if ( empty( $rows ) ) return '';
		return "\n" . implode( "\n", $rows ) . "\n\n";
	}

	private function find_child( $node, $tag ) {
		foreach ( $node->childNodes as $child ) {
			if ( $child->nodeType === XML_ELEMENT_NODE && strtolower( $child->nodeName ) === $tag ) {
				return $child;
			}
		}
		return null;
	}

	private function escape( $str ) {
		$str = wp_strip_all_tags( $str );
		return str_replace( array( '[', ']', '*', '_' ), array( '\[', '\]', '\*', '\_' ), $str );
	}

	private function escape_text( $str ) {
		// In text nodes, only escape characters that would form markdown syntax accidentally.
		// We don't escape * and _ in text — too aggressive.
		return $str;
	}
}
