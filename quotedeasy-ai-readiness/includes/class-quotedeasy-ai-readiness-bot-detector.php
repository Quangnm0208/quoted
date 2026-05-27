<?php
/**
 * Bot detector and allowlist.
 *
 * Identifies AI crawlers from the User-Agent header and logs each visit.
 *
 * @package QuotedEasy_AI_Readiness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class QuotedEasy_AI_Readiness_Bot_Detector {

	/**
	 * Canonical AI crawler catalog.
	 *
	 * Each entry: id => [ patterns (lowercase substrings), display, operator ].
	 * Longer / more specific patterns come before shorter ones with the same prefix.
	 */
	public static function bot_catalog() {
		return array(
			// Anthropic
			'ClaudeBot'            => array( 'patterns' => array( 'claudebot', 'anthropic-ai' ), 'display' => 'Claude', 'operator' => 'Anthropic' ),
			'Claude-User'          => array( 'patterns' => array( 'claude-user' ), 'display' => 'Claude-User', 'operator' => 'Anthropic (user-initiated)' ),
			'Claude-SearchBot'     => array( 'patterns' => array( 'claude-searchbot', 'claude-search' ), 'display' => 'Claude SearchBot', 'operator' => 'Anthropic (search index)' ),

			// OpenAI
			'GPTBot'               => array( 'patterns' => array( 'gptbot' ), 'display' => 'GPTBot', 'operator' => 'OpenAI (training)' ),
			'ChatGPT-User'         => array( 'patterns' => array( 'chatgpt-user' ), 'display' => 'ChatGPT-User', 'operator' => 'OpenAI (in-chat browsing)' ),
			'OAI-SearchBot'        => array( 'patterns' => array( 'oai-searchbot' ), 'display' => 'OAI-SearchBot', 'operator' => 'OpenAI (ChatGPT Search)' ),
			'OperatorBot'          => array( 'patterns' => array( 'operator/', 'openai-operator' ), 'display' => 'Operator', 'operator' => 'OpenAI (agentic browsing)' ),

			// Google
			'GoogleExtended'       => array( 'patterns' => array( 'google-extended' ), 'display' => 'Google-Extended', 'operator' => 'Google (Gemini + AI Overviews)' ),
			'GoogleOther-Image'    => array( 'patterns' => array( 'googleother-image' ), 'display' => 'GoogleOther-Image', 'operator' => 'Google (image training)' ),
			'GoogleOther'          => array( 'patterns' => array( 'googleother' ), 'display' => 'GoogleOther', 'operator' => 'Google (R&D crawler)' ),

			// Microsoft
			'Bingbot'              => array( 'patterns' => array( 'bingbot' ), 'display' => 'Bingbot', 'operator' => 'Microsoft (Bing + Copilot)' ),
			'MSNBot'               => array( 'patterns' => array( 'msnbot' ), 'display' => 'MSNBot', 'operator' => 'Microsoft (legacy crawler)' ),

			// Perplexity
			'PerplexityBot'        => array( 'patterns' => array( 'perplexitybot' ), 'display' => 'PerplexityBot', 'operator' => 'Perplexity (training)' ),
			'Perplexity-User'      => array( 'patterns' => array( 'perplexity-user' ), 'display' => 'Perplexity-User', 'operator' => 'Perplexity (user query)' ),

			// Apple
			'Applebot'             => array( 'patterns' => array( 'applebot/' ), 'display' => 'Applebot', 'operator' => 'Apple (Spotlight + Siri)' ),
			'Applebot-Extended'    => array( 'patterns' => array( 'applebot-extended' ), 'display' => 'Applebot-Extended', 'operator' => 'Apple Intelligence' ),

			// Meta
			'Meta-ExternalAgent'   => array( 'patterns' => array( 'meta-externalagent' ), 'display' => 'Meta-ExternalAgent', 'operator' => 'Meta AI / LLaMA' ),
			'Meta-ExternalFetcher' => array( 'patterns' => array( 'meta-externalfetcher' ), 'display' => 'Meta-ExternalFetcher', 'operator' => 'Meta AI (link previews)' ),
			'FacebookBot'          => array( 'patterns' => array( 'facebookbot' ), 'display' => 'FacebookBot', 'operator' => 'Meta (crawler)' ),

			// ByteDance / Doubao
			'Bytespider'           => array( 'patterns' => array( 'bytespider' ), 'display' => 'Bytespider', 'operator' => 'ByteDance / Doubao' ),
			'BytedanceUA'          => array( 'patterns' => array( 'bytedance' ), 'display' => 'Bytedance UA', 'operator' => 'ByteDance (variants)' ),

			// Other major LLM operators
			'MistralAI-User'       => array( 'patterns' => array( 'mistralai-user' ), 'display' => 'MistralAI-User', 'operator' => 'Mistral AI' ),
			'DeepSeekBot'          => array( 'patterns' => array( 'deepseekbot', 'deepseek-bot' ), 'display' => 'DeepSeekBot', 'operator' => 'DeepSeek' ),
			'CohereBot'            => array( 'patterns' => array( 'cohere-ai' ), 'display' => 'cohere-ai', 'operator' => 'Cohere' ),
			'CohereTraining'       => array( 'patterns' => array( 'cohere-training-data-crawler' ), 'display' => 'Cohere Training Crawler', 'operator' => 'Cohere (training corpus)' ),
			'xAI-Grok'             => array( 'patterns' => array( 'xai-bot', 'grokbot' ), 'display' => 'Grok', 'operator' => 'xAI' ),
			'YouBot'               => array( 'patterns' => array( 'youbot' ), 'display' => 'YouBot', 'operator' => 'You.com' ),
			'PhindBot'             => array( 'patterns' => array( 'phindbot' ), 'display' => 'PhindBot', 'operator' => 'Phind' ),
			'KagiBot'              => array( 'patterns' => array( 'kagibot' ), 'display' => 'KagiBot', 'operator' => 'Kagi Search' ),
			'Andibot'              => array( 'patterns' => array( 'andibot' ), 'display' => 'Andibot', 'operator' => 'Andi' ),
			'Komobot'              => array( 'patterns' => array( 'komobot', 'komo-bot' ), 'display' => 'KomoBot', 'operator' => 'Komo' ),

			// Major non-US AI ecosystems
			'Amazonbot'            => array( 'patterns' => array( 'amazonbot' ), 'display' => 'Amazonbot', 'operator' => 'Amazon (Alexa + Q)' ),
			'AliBot'               => array( 'patterns' => array( 'alibot', 'alibabasearch' ), 'display' => 'AliBot', 'operator' => 'Alibaba / Tongyi' ),
			'Baiduspider'          => array( 'patterns' => array( 'baiduspider' ), 'display' => 'Baiduspider', 'operator' => 'Baidu' ),
			'BaiduAI'              => array( 'patterns' => array( 'baidu-ai' ), 'display' => 'Baidu-AI', 'operator' => 'Baidu ERNIE' ),
			'NaverYeti'            => array( 'patterns' => array( 'yeti' ), 'display' => 'Yeti', 'operator' => 'Naver (Korea)' ),
			'NaverGPT'             => array( 'patterns' => array( 'navergpt' ), 'display' => 'NaverGPT', 'operator' => 'Naver CLOVA X' ),
			'YandexBot'            => array( 'patterns' => array( 'yandexbot' ), 'display' => 'YandexBot', 'operator' => 'Yandex' ),
			'Sogou'                => array( 'patterns' => array( 'sogou web spider', 'sogou spider' ), 'display' => 'Sogou Spider', 'operator' => 'Sogou (Tencent)' ),
			'PetalBot'             => array( 'patterns' => array( 'petalbot' ), 'display' => 'PetalBot', 'operator' => 'Huawei / Petal Search' ),

			// Privacy-focused search
			'DuckDuckBot'          => array( 'patterns' => array( 'duckduckbot' ), 'display' => 'DuckDuckBot', 'operator' => 'DuckDuckGo' ),
			'BraveBot'             => array( 'patterns' => array( 'brave/', 'bravesearchbot' ), 'display' => 'BraveBot', 'operator' => 'Brave Search' ),
			'MojeekBot'            => array( 'patterns' => array( 'mojeekbot' ), 'display' => 'MojeekBot', 'operator' => 'Mojeek' ),
			'SeznamBot'            => array( 'patterns' => array( 'seznambot' ), 'display' => 'SeznamBot', 'operator' => 'Seznam (Czech)' ),

			// Open data feeding LLM training
			'CCBot'                => array( 'patterns' => array( 'ccbot' ), 'display' => 'CCBot', 'operator' => 'Common Crawl' ),
			'AI2Bot'               => array( 'patterns' => array( 'ai2bot' ), 'display' => 'AI2Bot', 'operator' => 'Allen Institute for AI' ),
			'FriendlyCrawler'      => array( 'patterns' => array( 'friendlycrawler' ), 'display' => 'FriendlyCrawler', 'operator' => 'LAION' ),
			'ImagesiftBot'         => array( 'patterns' => array( 'imagesiftbot' ), 'display' => 'ImagesiftBot', 'operator' => 'Hive AI' ),
			'omgilibot'            => array( 'patterns' => array( 'omgilibot', 'omgili/' ), 'display' => 'omgilibot', 'operator' => 'Webz.io / Brandwatch' ),
			'Diffbot'              => array( 'patterns' => array( 'diffbot' ), 'display' => 'Diffbot', 'operator' => 'Diffbot' ),
			'SemanticScholarBot'   => array( 'patterns' => array( 'semanticscholarbot' ), 'display' => 'SemanticScholarBot', 'operator' => 'Allen Institute (academic search)' ),
			'TimpiBot'             => array( 'patterns' => array( 'timpibot' ), 'display' => 'TimpiBot', 'operator' => 'Timpi' ),
			'PleiasBot'            => array( 'patterns' => array( 'pleiasbot' ), 'display' => 'PleiasBot', 'operator' => 'Pleias' ),
			'Img2Dataset'          => array( 'patterns' => array( 'img2dataset' ), 'display' => 'img2dataset', 'operator' => 'Open image dataset tool' ),

			// SEO crawlers feeding LLM pipelines
			'AhrefsBot'            => array( 'patterns' => array( 'ahrefsbot' ), 'display' => 'AhrefsBot', 'operator' => 'Ahrefs' ),
			'SemrushBot'           => array( 'patterns' => array( 'semrushbot' ), 'display' => 'SemrushBot', 'operator' => 'Semrush' ),
			'DataForSEOBot'        => array( 'patterns' => array( 'dataforseobot' ), 'display' => 'DataForSEOBot', 'operator' => 'DataForSEO' ),
			'MJ12bot'              => array( 'patterns' => array( 'mj12bot' ), 'display' => 'MJ12bot', 'operator' => 'Majestic' ),

			// Archival sources
			'IA_Archiver'          => array( 'patterns' => array( 'ia_archiver' ), 'display' => 'ia_archiver', 'operator' => 'Internet Archive' ),
			'Wayback'              => array( 'patterns' => array( 'wayback/' ), 'display' => 'Wayback', 'operator' => 'Internet Archive (Wayback)' ),
		);
	}

	public static function bot_signatures() {
		$out = array();
		foreach ( self::bot_catalog() as $id => $info ) {
			$out[ $id ] = $info['patterns'];
		}
		return $out;
	}

	public static function bot_metadata() {
		$out = array();
		foreach ( self::bot_catalog() as $id => $info ) {
			$out[ $id ] = array( $info['display'], $info['operator'] );
		}
		return $out;
	}

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

	public function log_crawl( $bot_name, $url_path, $user_agent, $ip_raw ) {
		global $wpdb;
		$table = $wpdb->prefix . 'quotedeasy_ai_readiness_bot_log';

		$cached_count = get_transient( 'quotedeasy_ai_readiness_unsynced_count' );
		if ( $cached_count === false ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
			$cached_count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE synced = 0" );
			set_transient( 'quotedeasy_ai_readiness_unsynced_count', $cached_count, 60 );
		}

		// Keep the log bounded.
		if ( $cached_count >= 10000 ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery
			$deleted = (int) $wpdb->query( "DELETE FROM {$table} ORDER BY id ASC LIMIT 100" );
			if ( $deleted > 0 ) {
				$cached_count = max( 0, $cached_count - $deleted );
				set_transient( 'quotedeasy_ai_readiness_unsynced_count', $cached_count, 60 );
			} else {
				return false;
			}
		}

		$ip_hash  = $this->hash_ip( $ip_raw );

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
			set_transient( 'quotedeasy_ai_readiness_unsynced_count', (int) $cached_count + 1, 60 );
		}

		return $inserted !== false;
	}

	private function hash_ip( $ip_raw ) {
		if ( ! get_option( 'quotedeasy_ai_readiness_hash_ips', true ) ) {
			return 'raw:' . $ip_raw;
		}
		return 'sha256:' . hash( 'sha256', $ip_raw . wp_salt( 'auth' ) );
	}

	public static function is_allowed( $bot_name ) {
		$allowlist = get_option( 'quotedeasy_ai_readiness_bot_allowlist', array() );
		if ( ! is_array( $allowlist ) ) {
			return true;
		}
		if ( ! isset( $allowlist[ $bot_name ] ) ) {
			return true;
		}
		return $allowlist[ $bot_name ] !== 'block';
	}

	public static function blocked_bots() {
		$allowlist = get_option( 'quotedeasy_ai_readiness_bot_allowlist', array() );
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

	public static function robots_txt_block_rules() {
		$catalog = self::bot_catalog();
		$blocked = self::blocked_bots();
		if ( empty( $blocked ) ) {
			return '';
		}

		$out = "\n# QuotedEasy AI Readiness - AI crawler allowlist\n";
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

	public static function catalog_size() {
		return count( self::bot_catalog() );
	}
}
