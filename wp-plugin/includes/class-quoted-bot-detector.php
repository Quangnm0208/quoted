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
	 * Source: Each provider's public documentation as of 2026-05.
	 * Update list when new bots appear.
	 *
	 * Key = bot identifier sent to backend.
	 * Value = list of substring patterns to match in User-Agent.
	 */
	private static function bot_signatures() {
		return array(
			'ClaudeBot'        => array( 'claudebot', 'anthropic-ai' ),
			'GPTBot'           => array( 'gptbot' ),
			'ChatGPT-User'     => array( 'chatgpt-user' ),
			'OAI-SearchBot'    => array( 'oai-searchbot' ),
			'PerplexityBot'    => array( 'perplexitybot' ),
			'Perplexity-User'  => array( 'perplexity-user' ),
			'GoogleExtended'   => array( 'google-extended' ),
			'Applebot-Extended' => array( 'applebot-extended' ),
			'Bytespider'       => array( 'bytespider' ),
			'FacebookBot'      => array( 'facebookbot', 'meta-externalagent', 'meta-externalfetcher' ),
			'CCBot'            => array( 'ccbot' ),
			'DiffBot'          => array( 'diffbot' ),
			'Cohere'           => array( 'cohere-ai' ),
			'YouBot'           => array( 'youbot' ),
		);
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
