<?php
if (!defined('ABSPATH')) exit;
add_action('after_setup_theme', function () {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('automatic-feed-links');
    add_theme_support('responsive-embeds');
    add_theme_support('html5', ['search-form','gallery','caption','style','script']);
    register_nav_menus(['primary' => 'Header navigation']);
});
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style('blue-gold', get_stylesheet_uri(), [], '1.0.0');
});
function blue_gold_nav() {
    echo '<ul class="nav-list"><li><a href="' . esc_url(home_url('/')) . '">Home</a></li><li><a href="' . esc_url(home_url('/#journal')) . '">The journal</a></li></ul>';
}
