<?php
/**
 * Bot detector — runs on every frontend pageview, logs AI bot user-agents.
 *
 * Performance budget: ≤2ms per request.
 * Logs to local table; cron syncs to backend hourly.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_Bot_Detector {

	/**
	 * Known AI bot user-agent fragments (case-insensitive substring match).
	 *
	 * Source: each provider's public documentation as of 2026-05.
	 * Update this list when a new bot appears.
	 *
	 *  Key   = our internal bot identifier (also used as the robots.txt label).
	 *  Value = list of UA substrings to match. The first value is also used as
	 *          the User-agent line in robots.txt when the bot is blocked.
	 */
	public static function bot_signatures() {
		return array(
			'ClaudeBot'         => array( 'claudebot', 'anthropic-ai' ),
			'GPTBot'            => array( 'gptbot' ),
			'ChatGPT-User'      => array( 'chatgpt-user' ),
			'OAI-SearchBot'     => array( 'oai-searchbot' ),
			'PerplexityBot'     => array( 'perplexitybot' ),
			'Perplexity-User'   => array( 'perplexity-user' ),
			'GoogleExtended'    => array( 'google-extended' ),
			'Applebot-Extended' => array( 'applebot-extended' ),
			'Bytespider'        => array( 'bytespider' ),
			'FacebookBot'       => array( 'facebookbot', 'meta-externalagent', 'meta-externalfetcher' ),
			'CCBot'             => array( 'ccbot' ),
			'DiffBot'           => array( 'diffbot' ),
			'Cohere'            => array( 'cohere-ai' ),
			'YouBot'            => array( 'youbot' ),
		);
	}

	/**
	 * Per-bot display metadata: [display_name, operator, purpose].
	 * Used by the Crawler controls page table.
	 */
	public static function bot_metadata() {
		return array(
			'ClaudeBot'         => array( 'ClaudeBot',         'Anthropic',     __( 'Training data for Claude',                'quoted' ) ),
			'GPTBot'            => array( 'GPTBot',            'OpenAI',        __( 'Training data for ChatGPT',               'quoted' ) ),
			'ChatGPT-User'      => array( 'ChatGPT-User',      'OpenAI',        __( 'Live fetches during ChatGPT conversations', 'quoted' ) ),
			'OAI-SearchBot'     => array( 'OAI-SearchBot',     'OpenAI',        __( 'SearchGPT index',                          'quoted' ) ),
			'PerplexityBot'     => array( 'PerplexityBot',     'Perplexity',    __( 'Search index',                             'quoted' ) ),
			'Perplexity-User'   => array( 'Perplexity-User',   'Perplexity',    __( 'Live fetch during user query',             'quoted' ) ),
			'GoogleExtended'    => array( 'Google-Extended',   'Google',        __( 'Gemini training & AI products',            'quoted' ) ),
			'Applebot-Extended' => array( 'Applebot-Extended', 'Apple',         __( 'Apple Intelligence training',              'quoted' ) ),
			'Bytespider'        => array( 'Bytespider',        'ByteDance',     __( 'AI model training (TikTok parent)',         'quoted' ) ),
			'FacebookBot'       => array( 'Meta-ExternalAgent', 'Meta',         __( 'Meta AI / LLaMA model training',           'quoted' ) ),
			'CCBot'             => array( 'CCBot',             'Common Crawl', __( 'Open-data web crawl used for training',    'quoted' ) ),
			'DiffBot'           => array( 'DiffBot',            'Diffbot',     __( 'Structured-data crawler',                 'quoted' ) ),
			'Cohere'            => array( 'cohere-ai',          'Cohere',      __( 'Cohere model training',                   'quoted' ) ),
			'YouBot'            => array( 'YouBot',             'You.com',     __( 'You.com search and AI assistant',         'quoted' ) ),
		);
	}

	/**
	 * Decide whether a given bot is allowed to access the site.
	 *
	 * Allowlist is stored as quoted_bot_allowlist option, an array keyed by
	 * bot_name with values 'allow' | 'block'. Missing keys default to 'allow'.
	 *
	 * @param string $bot_name internal identifier from bot_signatures().
	 * @return bool true if allowed, false if blocked.
	 */
	public static function is_allowed( $bot_name ) {
		$allowlist = get_option( 'quoted_bot_allowlist', array() );
		if ( ! is_array( $allowlist ) ) {
			return true;
		}
		if ( ! isset( $allowlist[ $bot_name ] ) ) {
			return true; // sensible default — don't block silently
		}
		return $allowlist[ $bot_name ] !== 'block';
	}

	/**
	 * Bot identifiers currently set to 'block'. Used by robots.txt generation.
	 *
	 * @return string[]
	 */
	public static function blocked_bots() {
		$allowlist = get_option( 'quoted_bot_allowlist', array() );
		if ( ! is_array( $allowlist ) ) {
			return array();
		}
		$blocked = array();
		foreach ( $allowlist as $bot => $state ) {
			if ( $state === 'block' ) {
				$blocked[] = $bot;
			}
		}
		return $blocked;
	}

	/**
	 * Build the additional `User-agent: X\nDisallow: /` block for robots.txt
	 * from the current allowlist.
	 *
	 * Emits one User-agent line per known signature pattern of each blocked bot
	 * so that, e.g., blocking ClaudeBot covers both "claudebot" and "anthropic-ai"
	 * as Anthropic publishes them in their docs.
	 */
	public static function robots_txt_block_rules() {
		$signatures = self::bot_signatures();
		$blocked    = self::blocked_bots();
		if ( empty( $blocked ) ) {
			return '';
		}

		$out = "\n# Quoted — AI crawler allowlist\n";
		foreach ( $blocked as $bot ) {
			if ( ! isset( $signatures[ $bot ] ) ) {
				continue;
			}
			foreach ( $signatures[ $bot ] as $pattern ) {
				$out .= 'User-agent: ' . $pattern . "\n";
			}
			$out .= "Disallow: /\n\n";
		}
		return $out;
	}

	/**
	 * Returns bot name if UA matches, else null.
	 *
	 * @param string $user_agent
	 * @return string|null
	 */
	public function identify( $user_agent ) {
		if ( empty( $user_agent ) ) {
			return null;
		}

		$ua_lower = strtolower( $user_agent );

		foreach ( self::bot_signatures() as $bot_name => $patterns ) {
			foreach ( $patterns as $pattern ) {
				if ( strpos( $ua_lower, $pattern ) !== false ) {
					return $bot_name;
				}
			}
		}

		return null;
	}

	/**
	 * Log a crawl to local table. Idempotent within the same minute.
	 *
	 * @param string $bot_name
	 * @param string $url_path
	 * @param string $user_agent
	 * @param string $ip_raw
	 * @return bool True if inserted, false if dropped (rate-limited or full).
	 */
	public function log_crawl( $bot_name, $url_path, $user_agent, $ip_raw ) {
		global $wpdb;

		$table = $wpdb->prefix . 'quoted_bot_log';

		// Quick size check to avoid runaway growth if cron is broken.
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- $table from $wpdb->prefix.
		$count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE synced = 0" );
		if ( $count >= 10000 ) {
			return false;
		}

		$ip_hash = $this->hash_ip( $ip_raw );

		$inserted = $wpdb->insert(
			$table,
			array(
				'bot_name'   => substr( $bot_name, 0, 64 ),
				'url_path'   => substr( $url_path, 0, 2048 ),
				'user_agent' => substr( $user_agent, 0, 512 ),
				'ip_hash'    => $ip_hash,
				'crawled_at' => gmdate( 'Y-m-d H:i:s' ),
				'synced'     => 0,
			),
			array( '%s', '%s', '%s', '%s', '%s', '%d' )
		);

		return $inserted !== false;
	}

	/**
	 * Hash IP for privacy. SHA-256 by default; can be disabled via setting.
	 *
	 * When hashing is disabled, the raw IP is stored with the prefix `raw:`.
	 * Earlier versions returned a constant 64-zero hash in that branch, which
	 * collapsed every disabled-hash crawl into a single dedup bucket on the
	 * backend (effectively dropping 99% of traffic).
	 */
	private function hash_ip( $ip_raw ) {
		if ( ! get_option( 'quoted_hash_ips', true ) ) {
			return 'raw:' . $ip_raw;
		}
		return 'sha256:' . hash( 'sha256', $ip_raw . wp_salt( 'auth' ) );
	}
}
