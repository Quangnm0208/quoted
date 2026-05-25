<?php
/**
 * Bot detector — identifies AI / LLM crawlers on every frontend pageview.
 *
 * Performance budget: ≤ 2 ms per request.
 *
 * Detection is a case-insensitive substring scan on the User-Agent header.
 * Each entry in the catalog can match multiple UA fragments (Anthropic, for
 * example, ships both `ClaudeBot` and `anthropic-ai`).
 *
 * Allowlist is stored in the `quoted_bot_allowlist` option; missing keys
 * default to 'allow' so a new bot the operator hasn't seen doesn't get
 * silently blocked.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_Bot_Detector {

	/**
	 * Canonical AI / LLM crawler catalog.
	 *
	 * Sourced from each provider's public documentation, the ai.robots.txt
	 * community list, and Dark Visitors. Reviewed for 2026 currency.
	 *
	 * Schema:
	 *   id => array(
	 *     'patterns' => array<string>   // case-insensitive substring(s) to match in UA
	 *     'display'  => string          // friendly name for the Settings UI
	 *     'operator' => string          // brand / org behind the bot
	 *   )
	 *
	 * Adding a new bot? You only edit this method — bot_signatures() and
	 * bot_metadata() derive from it automatically.
	 */
	public static function bot_catalog() {
		return array(
			// ─── Anthropic ──────────────────────────────────────────────
			'ClaudeBot'        => array(
				'patterns' => array( 'claudebot', 'anthropic-ai' ),
				'display'  => 'Claude',
				'operator' => 'Anthropic',
			),
			'Claude-User'      => array(
				'patterns' => array( 'claude-user' ),
				'display'  => 'Claude-User',
				'operator' => 'Anthropic (user-initiated)',
			),
			'Claude-SearchBot' => array(
				'patterns' => array( 'claude-searchbot', 'claude-search' ),
				'display'  => 'Claude SearchBot',
				'operator' => 'Anthropic (search index)',
			),

			// ─── OpenAI ─────────────────────────────────────────────────
			'GPTBot'           => array(
				'patterns' => array( 'gptbot' ),
				'display'  => 'GPTBot',
				'operator' => 'OpenAI (training)',
			),
			'ChatGPT-User'     => array(
				'patterns' => array( 'chatgpt-user' ),
				'display'  => 'ChatGPT-User',
				'operator' => 'OpenAI (in-chat browsing)',
			),
			'OAI-SearchBot'    => array(
				'patterns' => array( 'oai-searchbot' ),
				'display'  => 'OAI-SearchBot',
				'operator' => 'OpenAI (ChatGPT Search)',
			),
			'OperatorBot'      => array(
				'patterns' => array( 'operator/', 'openai-operator' ),
				'display'  => 'Operator',
				'operator' => 'OpenAI (agentic browsing)',
			),

			// ─── Google ─────────────────────────────────────────────────
			'GoogleExtended'   => array(
				'patterns' => array( 'google-extended' ),
				'display'  => 'Google-Extended',
				'operator' => 'Google (Gemini + AI Overviews)',
			),
			// GoogleOther-Image is evaluated BEFORE GoogleOther because the
			// shorter pattern 'googleother' would otherwise match the longer
			// UA 'GoogleOther-Image' first. Substring search is first-wins.
			'GoogleOther-Image'=> array(
				'patterns' => array( 'googleother-image' ),
				'display'  => 'GoogleOther-Image',
				'operator' => 'Google (image training)',
			),
			'GoogleOther'      => array(
				'patterns' => array( 'googleother' ),
				'display'  => 'GoogleOther',
				'operator' => 'Google (R&D crawler)',
			),

			// ─── Microsoft ──────────────────────────────────────────────
			'Bingbot'          => array(
				'patterns' => array( 'bingbot' ),
				'display'  => 'Bingbot',
				'operator' => 'Microsoft (Bing + Copilot)',
			),
			'MSNBot'           => array(
				'patterns' => array( 'msnbot' ),
				'display'  => 'MSNBot',
				'operator' => 'Microsoft (legacy crawler)',
			),

			// ─── Perplexity ─────────────────────────────────────────────
			'PerplexityBot'    => array(
				'patterns' => array( 'perplexitybot' ),
				'display'  => 'PerplexityBot',
				'operator' => 'Perplexity (training)',
			),
			'Perplexity-User'  => array(
				'patterns' => array( 'perplexity-user' ),
				'display'  => 'Perplexity-User',
				'operator' => 'Perplexity (user query)',
			),

			// ─── Apple ──────────────────────────────────────────────────
			'Applebot'         => array(
				'patterns' => array( 'applebot/' ),
				'display'  => 'Applebot',
				'operator' => 'Apple (Spotlight + Siri)',
			),
			'Applebot-Extended'=> array(
				'patterns' => array( 'applebot-extended' ),
				'display'  => 'Applebot-Extended',
				'operator' => 'Apple Intelligence',
			),

			// ─── Meta ───────────────────────────────────────────────────
			'Meta-ExternalAgent' => array(
				'patterns' => array( 'meta-externalagent' ),
				'display'  => 'Meta-ExternalAgent',
				'operator' => 'Meta AI / LLaMA',
			),
			'Meta-ExternalFetcher' => array(
				'patterns' => array( 'meta-externalfetcher' ),
				'display'  => 'Meta-ExternalFetcher',
				'operator' => 'Meta AI (link previews)',
			),
			'FacebookBot'      => array(
				'patterns' => array( 'facebookbot' ),
				'display'  => 'FacebookBot',
				'operator' => 'Meta (crawler)',
			),

			// ─── ByteDance / Doubao ─────────────────────────────────────
			'Bytespider'       => array(
				'patterns' => array( 'bytespider' ),
				'display'  => 'Bytespider',
				'operator' => 'ByteDance / Doubao',
			),
			'BytedanceUA'      => array(
				'patterns' => array( 'bytedance' ),
				'display'  => 'Bytedance UA',
				'operator' => 'ByteDance (variants)',
			),

			// ─── Other major LLM operators ──────────────────────────────
			'MistralAI-User'   => array(
				'patterns' => array( 'mistralai-user' ),
				'display'  => 'MistralAI-User',
				'operator' => 'Mistral AI',
			),
			'DeepSeekBot'      => array(
				'patterns' => array( 'deepseekbot', 'deepseek-bot' ),
				'display'  => 'DeepSeekBot',
				'operator' => 'DeepSeek',
			),
			'CohereBot'        => array(
				'patterns' => array( 'cohere-ai' ),
				'display'  => 'cohere-ai',
				'operator' => 'Cohere',
			),
			'CohereTraining'   => array(
				'patterns' => array( 'cohere-training-data-crawler' ),
				'display'  => 'Cohere Training Crawler',
				'operator' => 'Cohere (training corpus)',
			),
			'xAI-Grok'         => array(
				'patterns' => array( 'xai-bot', 'grokbot' ),
				'display'  => 'Grok',
				'operator' => 'xAI',
			),
			'YouBot'           => array(
				'patterns' => array( 'youbot' ),
				'display'  => 'YouBot',
				'operator' => 'You.com',
			),
			'PhindBot'         => array(
				'patterns' => array( 'phindbot' ),
				'display'  => 'PhindBot',
				'operator' => 'Phind',
			),
			'KagiBot'          => array(
				'patterns' => array( 'kagibot' ),
				'display'  => 'KagiBot',
				'operator' => 'Kagi Search',
			),
			'Andibot'          => array(
				'patterns' => array( 'andibot' ),
				'display'  => 'Andibot',
				'operator' => 'Andi',
			),
			'Komobot'          => array(
				'patterns' => array( 'komobot', 'komo-bot' ),
				'display'  => 'KomoBot',
				'operator' => 'Komo',
			),

			// ─── Major non-US AI ecosystems ─────────────────────────────
			'Amazonbot'        => array(
				'patterns' => array( 'amazonbot' ),
				'display'  => 'Amazonbot',
				'operator' => 'Amazon (Alexa + Q)',
			),
			'AliBot'           => array(
				'patterns' => array( 'alibot', 'alibabasearch' ),
				'display'  => 'AliBot',
				'operator' => 'Alibaba / Tongyi',
			),
			'Baiduspider'      => array(
				'patterns' => array( 'baiduspider' ),
				'display'  => 'Baiduspider',
				'operator' => 'Baidu',
			),
			'BaiduAI'          => array(
				'patterns' => array( 'baidu-ai' ),
				'display'  => 'Baidu-AI',
				'operator' => 'Baidu ERNIE',
			),
			'NaverYeti'        => array(
				'patterns' => array( 'yeti' ),
				'display'  => 'Yeti',
				'operator' => 'Naver (Korea)',
			),
			'NaverGPT'         => array(
				'patterns' => array( 'navergpt' ),
				'display'  => 'NaverGPT',
				'operator' => 'Naver CLOVA X',
			),
			'YandexBot'        => array(
				'patterns' => array( 'yandexbot' ),
				'display'  => 'YandexBot',
				'operator' => 'Yandex',
			),
			'Sogou'            => array(
				'patterns' => array( 'sogou web spider', 'sogou spider' ),
				'display'  => 'Sogou Spider',
				'operator' => 'Sogou (Tencent)',
			),
			'PetalBot'         => array(
				'patterns' => array( 'petalbot' ),
				'display'  => 'PetalBot',
				'operator' => 'Huawei / Petal Search',
			),

			// ─── Privacy-friendly search engines (some surface AI summaries) ─
			'DuckDuckBot'      => array(
				'patterns' => array( 'duckduckbot' ),
				'display'  => 'DuckDuckBot',
				'operator' => 'DuckDuckGo',
			),
			'BraveBot'         => array(
				'patterns' => array( 'brave/', 'bravesearchbot' ),
				'display'  => 'BraveBot',
				'operator' => 'Brave Search',
			),
			'MojeekBot'        => array(
				'patterns' => array( 'mojeekbot' ),
				'display'  => 'MojeekBot',
				'operator' => 'Mojeek',
			),
			'SeznamBot'        => array(
				'patterns' => array( 'seznambot' ),
				'display'  => 'SeznamBot',
				'operator' => 'Seznam (Czech)',
			),

			// ─── Common Crawl + open data feeding LLM training ──────────
			'CCBot'            => array(
				'patterns' => array( 'ccbot' ),
				'display'  => 'CCBot',
				'operator' => 'Common Crawl',
			),
			'AI2Bot'           => array(
				'patterns' => array( 'ai2bot' ),
				'display'  => 'AI2Bot',
				'operator' => 'Allen Institute for AI',
			),
			'FriendlyCrawler'  => array(
				'patterns' => array( 'friendlycrawler' ),
				'display'  => 'FriendlyCrawler',
				'operator' => 'LAION (open image datasets)',
			),
			'ImagesiftBot'     => array(
				'patterns' => array( 'imagesiftbot' ),
				'display'  => 'ImagesiftBot',
				'operator' => 'Hive AI',
			),
			'omgilibot'        => array(
				'patterns' => array( 'omgilibot', 'omgili/' ),
				'display'  => 'omgilibot',
				'operator' => 'Webz.io / Brandwatch',
			),
			'Diffbot'          => array(
				'patterns' => array( 'diffbot' ),
				'display'  => 'Diffbot',
				'operator' => 'Diffbot',
			),
			'SemanticScholarBot' => array(
				'patterns' => array( 'semanticscholarbot' ),
				'display'  => 'SemanticScholarBot',
				'operator' => 'Allen Institute (academic search)',
			),
			'TimpiBot'         => array(
				'patterns' => array( 'timpibot' ),
				'display'  => 'TimpiBot',
				'operator' => 'Timpi (decentralized search)',
			),
			'PleiasBot'        => array(
				'patterns' => array( 'pleiasbot' ),
				'display'  => 'PleiasBot',
				'operator' => 'Pleias (open LLM training)',
			),
			'Img2Dataset'      => array(
				'patterns' => array( 'img2dataset' ),
				'display'  => 'img2dataset',
				'operator' => 'Open image dataset tool',
			),

			// ─── SEO crawlers that resell data to LLM training pipelines ─
			'AhrefsBot'        => array(
				'patterns' => array( 'ahrefsbot' ),
				'display'  => 'AhrefsBot',
				'operator' => 'Ahrefs',
			),
			'SemrushBot'       => array(
				'patterns' => array( 'semrushbot' ),
				'display'  => 'SemrushBot',
				'operator' => 'Semrush',
			),
			'DataForSEOBot'    => array(
				'patterns' => array( 'dataforseobot' ),
				'display'  => 'DataForSEOBot',
				'operator' => 'DataForSEO',
			),
			'MJ12bot'          => array(
				'patterns' => array( 'mj12bot' ),
				'display'  => 'MJ12bot',
				'operator' => 'Majestic',
			),

			// ─── Archival sources that LLMs train on ────────────────────
			'IA_Archiver'      => array(
				'patterns' => array( 'ia_archiver' ),
				'display'  => 'ia_archiver',
				'operator' => 'Internet Archive',
			),
			'Wayback'          => array(
				'patterns' => array( 'wayback/' ),
				'display'  => 'Wayback',
				'operator' => 'Internet Archive (Wayback)',
			),
		);
	}

	/**
	 * Legacy interface: returns id => array of UA substring patterns.
	 * Derived from bot_catalog().
	 */
	public static function bot_signatures() {
		$out = array();
		foreach ( self::bot_catalog() as $id => $info ) {
			$out[ $id ] = $info['patterns'];
		}
		return $out;
	}

	/**
	 * Legacy interface: returns id => array( display_name, operator ).
	 * Used by the Settings → AI Crawler Allowlist UI.
	 */
	public static function bot_metadata() {
		$out = array();
		foreach ( self::bot_catalog() as $id => $info ) {
			$out[ $id ] = array( $info['display'], $info['operator'] );
		}
		return $out;
	}

	/**
	 * Returns bot id if UA matches, else null.
	 *
	 * @param string $user_agent Raw User-Agent header value.
	 * @return string|null
	 */
	public function identify( $user_agent ) {
		if ( empty( $user_agent ) ) {
			return null;
		}

		$ua_lower = strtolower( $user_agent );

		foreach ( self::bot_catalog() as $bot_name => $info ) {
			foreach ( $info['patterns'] as $pattern ) {
				if ( strpos( $ua_lower, $pattern ) !== false ) {
					return $bot_name;
				}
			}
		}

		return null;
	}

	/**
	 * Log a crawl to the local table.
	 *
	 * Runs on every detected bot hit, so the size check at the top is
	 * memoised in a 60-second transient — eliminates ~99% of the
	 * SELECT COUNT(*) calls on high-traffic sites.
	 */
	public function log_crawl( $bot_name, $url_path, $user_agent, $ip_raw ) {
		global $wpdb;
		$table = $wpdb->prefix . 'quoted_bot_log';

		$cached_count = get_transient( 'quoted_unsynced_count' );
		if ( $cached_count === false ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- $table from $wpdb->prefix.
			$cached_count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE synced = 0" );
			set_transient( 'quoted_unsynced_count', $cached_count, 60 );
		}

		// B8: at the cap, prune the oldest 100 rows so the log keeps moving
		// forward instead of silently going read-only. The 100-row batch is
		// big enough that we don't prune on every insert, small enough to
		// stay cheap (indexed PRIMARY KEY ORDER BY).
		if ( $cached_count >= 10000 ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- $table from $wpdb->prefix.
			$deleted = (int) $wpdb->query( "DELETE FROM {$table} ORDER BY id ASC LIMIT 100" );
			if ( $deleted > 0 ) {
				$cached_count = max( 0, $cached_count - $deleted );
				set_transient( 'quoted_unsynced_count', $cached_count, 60 );
			} else {
				// Couldn't prune (table empty or storage engine quirk) — fail safe.
				return false;
			}
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

		if ( $inserted ) {
			// Increment the cached count instead of busting it — keeps the
			// transient warm for the next request.
			set_transient( 'quoted_unsynced_count', (int) $cached_count + 1, 60 );
		}

		return $inserted !== false;
	}

	/**
	 * Hash IP for privacy. SHA-256 by default; raw fallback when hashing is
	 * disabled (the toggle in Settings → Privacy).
	 */
	private function hash_ip( $ip_raw ) {
		if ( ! get_option( 'quoted_hash_ips', true ) ) {
			return 'raw:' . $ip_raw;
		}
		return 'sha256:' . hash( 'sha256', $ip_raw . wp_salt( 'auth' ) );
	}

	/**
	 * Allowlist helpers — operator decides which bots can use the site.
	 */
	public static function is_allowed( $bot_name ) {
		$allowlist = get_option( 'quoted_bot_allowlist', array() );
		if ( ! is_array( $allowlist ) ) {
			return true;
		}
		if ( ! isset( $allowlist[ $bot_name ] ) ) {
			return true;
		}
		return $allowlist[ $bot_name ] !== 'block';
	}

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
	 * Build the additional `User-agent: X\nDisallow: /` block for robots.txt.
	 * Emits one User-agent line per signature pattern of each blocked bot.
	 */
	public static function robots_txt_block_rules() {
		$catalog = self::bot_catalog();
		$blocked = self::blocked_bots();
		if ( empty( $blocked ) ) {
			return '';
		}

		$out = "\n# Quoted — AI crawler allowlist\n";
		foreach ( $blocked as $bot ) {
			if ( ! isset( $catalog[ $bot ] ) ) {
				continue;
			}
			foreach ( $catalog[ $bot ]['patterns'] as $pattern ) {
				$out .= 'User-agent: ' . $pattern . "\n";
			}
			$out .= "Disallow: /\n\n";
		}
		return $out;
	}

	/**
	 * Used by Quoted_Activator on uninstall + by the dashboard summary.
	 * Returns the count of bot identifiers in the catalog (for "X bots tracked" UI copy).
	 */
	public static function catalog_size() {
		return count( self::bot_catalog() );
	}
}
