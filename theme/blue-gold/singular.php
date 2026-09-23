<?php get_header(); ?>
<main id="main" class="article-wrap">
<?php while(have_posts()) : the_post(); ?>
<article <?php post_class(); ?>><a class="read-more" href="<?php echo esc_url(home_url('/#journal')); ?>">&larr; Back to the journal</a>
<?php if(is_single()) : ?><p class="post-meta"><?php echo esc_html(get_the_date('F j, Y')); ?></p><?php endif; ?>
<h1><?php the_title(); ?></h1>
<?php if(is_single()) : ?><p class="article-byline">By <?php the_author(); ?></p><?php endif; ?>
<?php if(has_post_thumbnail()) the_post_thumbnail('large',['class'=>'article-image']); ?>
<div class="entry-content"><?php the_content(); wp_link_pages(); ?></div></article>
<?php if(is_single()) the_post_navigation(); ?>
<?php endwhile; ?>
</main>
<?php get_footer(); ?>
