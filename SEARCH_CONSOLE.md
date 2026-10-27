# Google Search Console: Next Steps

Website: https://ethanli0831.github.io/RealWorth/

Sitemap: https://ethanli0831.github.io/RealWorth/sitemap.xml

## Current status

The owner has confirmed successful HTML-file ownership verification. Keep
`docs/google7bf7bdb92ac21724.html` published; removing it can affect continued
verification. Ownership verification does not mean Google has indexed the site.
The owner subsequently supplied a URL Inspection screenshot showing that the
home page is indexed and that a recrawl request was accepted. This establishes
the reported home-page status at that time, not indexing for every page. The
previous sitemap fetch error has not been confirmed resolved in Search Console.

## 1. Submit the sitemap

1. In the verification confirmation, click **Go to property**.
2. Select **Sitemaps** in the left navigation.
3. Under **Add a new sitemap**, enter `sitemap.xml` if the property prefix is
   already shown. If a full URL is required, enter the complete sitemap URL above.
4. Click **Submit** and inspect the reported status.

A successful sitemap submission means Google received it, not that every URL
has already been indexed.

## 2. Inspect the main pages

Use **URL inspection** for the home page and the static Chinese overview:

- https://ethanli0831.github.io/RealWorth/
- https://ethanli0831.github.io/RealWorth/zh.html

Read the indexing status, run the live test if needed, and select **Request
indexing** when available. In **Page indexing**, distinguish undiscovered URLs,
discovered-but-not-indexed pages, crawled-but-not-indexed pages, canonical/duplicate
choices and actual fetch errors. Respond to the specific issue rather than
repeatedly submitting the same address.

Indexing and ranking are Google's decisions. A sitemap, canonical tag or indexing
request does not guarantee inclusion, a deadline or a ranking for competitive
terms such as Bitcoin. A `site:` search can provide a clue, but it is not a full
index inventory; Search Console is the better owner diagnostic.

## Existing site configuration

The eleven content pages have distinct titles/descriptions, project-scoped
canonical URLs, index/follow declarations, share metadata and truthful WebPage
identity. The English and Chinese home overviews have reciprocal language links.
About and Methodology explain the project's maintenance, sources and limitations.
The explainer hub links three original research notes with fixed, dated tables
and immutable source links. Home, Research, the Explore directory and README link
to them. Article tables intentionally remain separate from refreshed tool data.
The verification file is intentionally excluded from the content sitemap.

Google reads robots rules at the origin root:
`https://ethanli0831.github.io/robots.txt`.
A file under `/RealWorth/robots.txt` would not control those rules. The recorded
root check returned 404, with no explicit robots-file prohibition found. This
alone does not establish Google's actual indexing status.

## Optional repository About link

The GitHub integration returned HTTP 403 when attempting to edit repository
metadata. The owner can open the repository's **About → gear**, set Website to
the public site URL and add an accurate English project description. The README
already links the site. Do not invent credentials, reviews or return claims.

Suggested description:

> Open-source dashboard comparing Bitcoin, gold, stocks and Treasuries through purchasing power, risk and transparent market evidence.

## Branded search: what the owner can do next

Use the same public name and site URL on profiles you control:

> RealWorth — Bitcoin, Gold & Purchasing Power Research
>
> Compare Bitcoin, gold, stocks and Treasury funds after inflation, with transparent risk research and market monitoring.
>
> https://ethanli0831.github.io/RealWorth/

The website and README use this identity. Personal and social profiles are
outside this repository and have not been edited. Genuine public references
can help people and search engines associate the name with this project; they
do not guarantee a position in search results.

Inspect these new URLs in Search Console and request indexing if appropriate:

- https://ethanli0831.github.io/RealWorth/learn.html
- https://ethanli0831.github.io/RealWorth/bitcoin-inflation.html
- https://ethanli0831.github.io/RealWorth/compare-purchasing-power.html
- https://ethanli0831.github.io/RealWorth/forecast-evidence.html

In **Performance → Search results**, filter queries containing `realworth` and
review impressions, clicks and average position over time. New reports can be
empty or delayed; average position is not a fixed ranking for every person.
Repeated indexing requests do not move a page up the crawl queue. The sitemap
URL is unchanged and now lists eleven pages, excluding the verification file.

Official references:

- https://developers.google.com/search/docs/fundamentals/get-on-google
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl

An optional [Chinese setup guide](SEARCH_CONSOLE.zh-CN.md) is retained for reference.
