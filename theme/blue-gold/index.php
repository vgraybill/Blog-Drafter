<?php get_header(); ?>
<main id="main">
<?php if (is_home() && !is_paged()) : ?>
<section class="masthead" aria-labelledby="masthead-title"><div class="wrap masthead-inner"><p class="eyebrow">Welcome to the journal</p><h1 id="masthead-title">A little inspiration.<br><em>A fresh perspective.</em></h1><p class="intro">Thoughtful stories and useful ideas, collected in one place. Take a moment. Find something worth reading.</p><a class="button" href="#journal">Explore the journal &nbsp; &darr;</a></div></section><div class="accent-line" aria-hidden="true"></div>
<?php endif; ?>
<section class="wrap journal" id="journal" aria-labelledby="journal-title"><div class="section-heading"><div><div class="section-kicker">From the journal</div><h2 id="journal-title"><?php if(is_archive()) the_archive_title(); elseif(is_search()) echo 'Search results'; elseif(is_404()) echo 'Page not found'; else echo 'The latest stories'; ?></h2><p>Something new to discover. Something useful to take away.</p></div><span class="edition">Ideas worth sharing</span></div>
<?php if (have_posts()) : ?><div class="post-grid">
<?php while (have_posts()) : the_post(); ?>
<article <?php post_class('post-card'); ?>>
<a class="card-image" href="<?php the_permalink(); ?>" aria-label="<?php echo esc_attr('Read ' . get_the_title()); ?>"><?php if(has_post_thumbnail()) the_post_thumbnail('medium_large'); else echo '<div class="artwork" aria-hidden="true"></div>'; ?></a>
<div class="card-body"><div class="post-meta"><?php echo esc_html(get_the_date('M j, Y')); ?></div><h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3><p><?php echo esc_html(wp_trim_words(get_the_excerpt(), 25)); ?></p><a class="read-more" href="<?php the_permalink(); ?>">Read story <span aria-hidden="true">&rarr;</span><span class="screen-reader-text">: <?php the_title(); ?></span></a></div>
</article>
<?php endwhile; ?></div><?php the_posts_pagination(['mid_size'=>1]); ?>
<?php else : ?><p class="welcome-note">There are no stories here yet. <a href="<?php echo esc_url(home_url('/')); ?>">Return home</a> or check back soon.</p><?php endif; ?>
</section></main>
<?php get_footer(); ?>
