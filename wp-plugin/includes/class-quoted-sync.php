<?php
/**
 * Sync — handles cron jobs that push data to the backend.
 *
 * @package Quoted
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Quoted_Sync {

	const BATCH_SIZE = 500;

	/**
	 * Cron: sync local bot crawls to backend.
	 */
	public function sync_bot_crawls() {
		$license = new Quoted_License();
		if ( ! $license->is_connected() ) {
			return;
		}

		global $wpdb;
		$table = $wpdb->prefix . 'quoted_bot_log';

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- $table is built from $wpdb->prefix, not user input.
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$table} WHERE synced = 0 ORDER BY id ASC LIMIT %d",
			self::BATCH_SIZE
		) );

		if ( empty( $rows ) ) {
			return;
		}

		$events = array();
		$ids = array();
		foreach ( $rows as $row ) {
			$events[] = array(
				'bot_name'   => $row->bot_name,
				'url_path'   => $row->url_path,
				'user_agent' => $row->user_agent,
				'ip_hash'    => $row->ip_hash,
				'crawled_at' => gmdate( 'c', strtotime( $row->crawled_at . ' UTC' ) ),
			);
			$ids[] = (int) $row->id;
		}

		$api = new Quoted_Api_Client();
		$result = $api->request( 'POST', '/api/v1/bot-crawls/batch', array(
			'batch_id' => 'wp_' . wp_generate_uuid4(),
			'events'   => $events,
		) );

		if ( is_wp_error( $result ) ) {
			error_log( 'Quoted sync_bot_crawls failed: ' . $result->get_error_message() );
			return;
		}

		// Mark synced — placeholders for each id keep prepare() happy.
		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- $table from $wpdb->prefix, placeholders for ids.
		$wpdb->query( $wpdb->prepare(
			"UPDATE {$table} SET synced = 1 WHERE id IN ({$placeholders})",
			$ids
		) );

		// Cleanup: delete synced rows older than 7 days. Compare against
		// crawled_at (UTC) instead of created_at (server-local) so retention
		// is consistent regardless of MySQL timezone.
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- $table from $wpdb->prefix.
		$wpdb->query( $wpdb->prepare(
			"DELETE FROM {$table} WHERE synced = 1 AND crawled_at < %s",
			gmdate( 'Y-m-d H:i:s', time() - ( 7 * DAY_IN_SECONDS ) )
		) );
	}

	/**
	 * Cron: sync recently modified posts to backend.
	 */
	public function sync_posts() {
		$license = new Quoted_License();
		if ( ! $license->is_connected() ) {
			return;
		}

		// Posts modified in last 24 hours.
		$args = array(
			'post_type'      => array( 'post', 'page' ),
			'post_status'    => 'publish',
			'posts_per_page' => 50,
			'date_query'     => array(
				array(
					'column' => 'post_modified_gmt',
					'after'  => '24 hours ago',
				),
			),
			'orderby'        => 'modified',
			'order'          => 'DESC',
		);

		$posts = get_posts( $args );
		if ( empty( $posts ) ) {
			return;
		}

		$payload = array();
		foreach ( $posts as $post ) {
			$categories = wp_get_post_categories( $post->ID, array( 'fields' => 'slugs' ) );
			$tags = wp_get_post_tags( $post->ID, array( 'fields' => 'slugs' ) );

			$payload[] = array(
				'wp_post_id'    => (int) $post->ID,
				'slug'          => $post->post_name,
				'title'         => $post->post_title,
				'excerpt'       => wp_trim_words( wp_strip_all_tags( $post->post_content ), 40 ),
				'content_html'  => $post->post_content,
				'author'        => get_the_author_meta( 'display_name', $post->post_author ),
				'categories'    => $categories,
				'tags'          => $tags,
				'published_at'  => gmdate( 'c', strtotime( $post->post_date_gmt . ' UTC' ) ),
				'modified_at'   => gmdate( 'c', strtotime( $post->post_modified_gmt . ' UTC' ) ),
				'url'           => get_permalink( $post ),
			);
		}

		$api = new Quoted_Api_Client();
		$result = $api->request( 'POST', '/api/v1/wp-sites/posts/sync', array(
			'posts' => $payload,
		) );

		if ( is_wp_error( $result ) ) {
			error_log( 'Quoted sync_posts failed: ' . $result->get_error_message() );
			return;
		}

		// Flush llms.txt cache so next request rebuilds.
		Quoted_Llms_Txt::flush_cache();
	}

	/**
	 * Cron: refresh JWT if expiring within 2 hours.
	 */
	public function refresh_token_if_needed() {
		$expires_at = (int) get_option( 'quoted_jwt_expires_at', 0 );

		if ( $expires_at === 0 ) {
			return;
		}

		// Refresh if less than 2 hours remaining.
		if ( $expires_at - time() > 7200 ) {
			return;
		}

		$api = new Quoted_Api_Client();
		$result = $api->request( 'POST', '/api/v1/wp-sites/refresh-token' );

		if ( is_wp_error( $result ) ) {
			error_log( 'Quoted token refresh failed: ' . $result->get_error_message() );
			return;
		}

		if ( ! empty( $result['jwt'] ) && ! empty( $result['jwt_expires_at'] ) ) {
			$expires_at = strtotime( $result['jwt_expires_at'] );
			if ( $expires_at !== false && $expires_at > time() ) {
				update_option( 'quoted_jwt', $result['jwt'] );
				update_option( 'quoted_jwt_expires_at', $expires_at );
			} else {
				error_log( 'Quoted token refresh got invalid jwt_expires_at; ignoring response' );
			}
		}
	}

	/**
	 * One-shot sync of all posts (used in onboarding step 4).
	 *
	 * @param int $limit Maximum posts to sync.
	 * @return array Result summary with keys: synced, errors.
	 */
	public function initial_sync( $limit = 20 ) {
		$license = new Quoted_License();
		if ( ! $license->is_connected() ) {
			return array( 'synced' => 0, 'errors' => array( 'not_connected' ) );
		}

		$args = array(
			'post_type'      => array( 'post', 'page' ),
			'post_status'    => 'publish',
			'posts_per_page' => $limit,
			'orderby'        => 'modified',
			'order'          => 'DESC',
		);

		$posts = get_posts( $args );
		if ( empty( $posts ) ) {
			return array( 'synced' => 0, 'errors' => array() );
		}

		$payload = array();
		foreach ( $posts as $post ) {
			$categories = wp_get_post_categories( $post->ID, array( 'fields' => 'slugs' ) );
			$tags = wp_get_post_tags( $post->ID, array( 'fields' => 'slugs' ) );

			$payload[] = array(
				'wp_post_id'    => (int) $post->ID,
				'slug'          => $post->post_name,
				'title'         => $post->post_title,
				'excerpt'       => wp_trim_words( wp_strip_all_tags( $post->post_content ), 40 ),
				'content_html'  => $post->post_content,
				'author'        => get_the_author_meta( 'display_name', $post->post_author ),
				'categories'    => $categories,
				'tags'          => $tags,
				'published_at'  => gmdate( 'c', strtotime( $post->post_date_gmt . ' UTC' ) ),
				'modified_at'   => gmdate( 'c', strtotime( $post->post_modified_gmt . ' UTC' ) ),
				'url'           => get_permalink( $post ),
			);
		}

		$api = new Quoted_Api_Client();
		$result = $api->request( 'POST', '/api/v1/wp-sites/posts/sync', array(
			'posts' => $payload,
		) );

		if ( is_wp_error( $result ) ) {
			return array(
				'synced' => 0,
				'errors' => array( $result->get_error_message() ),
			);
		}

		Quoted_Llms_Txt::flush_cache();
		return array(
			'synced' => isset( $result['synced'] ) ? (int) $result['synced'] : 0,
			'errors' => isset( $result['errors'] ) ? $result['errors'] : array(),
		);
	}
}
