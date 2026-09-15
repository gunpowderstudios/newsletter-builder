# Gunpowder News Builder v1.0

A small static GitHub Pages app for building the Gunpowder Studios Brevo newsletter from WordPress posts.

## What it does

- Pulls the 12 newest WordPress posts from `gunpowderstudios.co.uk` using the WordPress REST API.
- Lets you choose up to 4 stories.
- Auto-fills featured image, title, article link and a short teaser.
- Lets you edit teaser text, title, button copy, image URL and article URL.
- Lets you reorder stories.
- Includes an editable Wasted Wizard Tavern / Mary introduction.
- Shows a live desktop or mobile email preview.
- Generates complete Brevo-ready HTML with `{{ contact.EMAIL }}`, `{{ mirror }}` and `{{ unsubscribe }}` tags.
- Saves the current draft and “used story” marks in browser localStorage.

## GitHub Pages

This is a dependency-free static app. Put `index.html`, `styles.css` and `app.js` in the root of a public GitHub repository, then enable GitHub Pages from the `main` branch/root in repository Settings → Pages.

## WordPress API

The app reads:

`https://www.gunpowderstudios.co.uk/wp-json/wp/v2/posts?per_page=12&_embed=1`

If WordPress blocks cross-origin REST requests in future, the app will show an error rather than silently failing.

## Brevo workflow

1. Publish news posts in WordPress.
2. Open the builder.
3. Click **Refresh stories**.
4. Select up to four stories (or **Select latest 4**).
5. Edit Mary's introduction and story previews.
6. Preview Desktop/Mobile.
7. Click **Copy Brevo HTML**.
8. Paste into Brevo Developer Mode, preview/test, then send.
