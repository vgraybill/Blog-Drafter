<!doctype html>
<html <?php language_attributes(); ?>>
<head><meta charset="<?php bloginfo('charset'); ?>"><meta name="viewport" content="width=device-width, initial-scale=1"><?php wp_head(); ?></head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap header-inner">
<a class="brand" href="<?php echo esc_url(home_url('/')); ?>"><span class="brand-mark" aria-hidden="true">B</span><span class="brand-name"><?php bloginfo('name'); ?><span class="brand-caption">Ideas, stories &amp; inspiration</span></span></a>
<nav aria-label="Main navigation"><?php wp_nav_menu(['theme_location'=>'primary','container'=>false,'menu_class'=>'nav-list','fallback_cb'=>'blue_gold_nav','depth'=>1]); ?></nav>
</div></header>
