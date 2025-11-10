onst cheerio = require('cheerio');
const { mapJsonLdToProperty } = require('./property_mapper');
const {
  extractNearbySchoolsFromHtml
} = require('./school_extractor');

/**
 * Safely parse JSON, returning null on failure.
 */
function safeJsonParse(text) {
  try {
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Extract all JSON-LD objects from the page.
 */
function extractJsonLdObjects(html) {
  const $ = cheerio.load(html);
  const results = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().toString().trim();
    const parsed = safeJsonParse(text);
    if (!parsed) return;
    if (Array.isArray(parsed)) {
      parsed.forEach((obj) => results.push(obj));
    } else {
      results.push(parsed);
    }
  });

  return results;
}

/**
 * Heuristic filter for property-related JSON-LD objects.
 */
function isPropertyJsonLd(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const type = obj['@type'];
  if (Array.isArray(type)) {
    return type.some((t) =>
      ['SingleFamilyResidence', 'House', 'Apartment', 'Residence'].includes(t)
    );
  }
  return ['SingleFamilyResidence', 'House', 'Apartment', 'Residence'].includes(
    type
  );
}

/**
 * Parse search results HTML and produce normalized property objects.
 */
function parseSearchResultsFromHtml(html, options = {}) {
  const { defaultStatus = 'BUY' } = options;
  const jsonLdObjects = extractJsonLdObjects(html);
  const nearbySchools = extractNearbySchoolsFromHtml(html);
  const properties = [];

  for (const obj of jsonLdObjects) {
    if (!isPropertyJsonLd(obj)) continue;
    const property = mapJsonLdToProperty(obj, {
      status: defaultStatus.toLowerCase(),
      nearbySchools
    });
    if (property) properties.push(property);
  }

  // Fallback: try to parse cards if JSON-LD isn't found
  if (properties.length === 0) {
    const $ = cheerio.load(html);
    $('.component_property-card, [data-testid="property-card"]').each(
      (_, el) => {
        const card = $(el);
        const url =
          card.find('a').attr('href') ||
          card.find('a[data-testid="property-anchor"]').attr('href');
        if (!url) return;

        const priceText =
          card.find('[data-label="pc-price"]').text().trim() ||
          card.find('[data-testid="property-price"]').text().trim();
        const priceMatch = priceText.replace(/[^0-9]/g, '');
        const listPrice = priceMatch ? Number(priceMatch) : null;

        const bedsText =
          card.find('[data-label="pc-meta-beds"]').text().trim() ||
          card.find('[data-testid="property-beds"]').text().trim();
        const bathsText =
          card.find('[data-label="pc-meta-baths"]').text().trim() ||
          card.find('[data-testid="property-baths"]').text().trim();

        const beds = bedsText ? Number(bedsText.replace(/[^0-9.]/g, '')) : null;
        const baths = bathsText
          ? Number(bathsText.replace(/[^0-9.]/g, ''))
          : null;

        const addressText =
          card.find('[data-label="pc-address"]').text().trim() ||
          card.find('[data-testid="property-address"]').text().trim();

        const raw = {
          url,
          offers: { price: listPrice },
          numberOfRooms: beds,
          numberOfBathroomsTotal: baths,
          address: { streetAddress: addressText }
        };

        const mapped = mapJsonLdToProperty(raw, {
          status: defaultStatus.toLowerCase(),
          nearbySchools
        });
        if (mapped) properties.push(mapped);
      }
    );
  }

  return properties;
}

/**
 * Parse a single property detail HTML page.
 */
function parsePropertyDetailFromHtml(html, options = {}) {
  const { status = 'buy' } = options;
  const jsonLdObjects = extractJsonLdObjects(html);
  const nearbySchools = extractNearbySchoolsFromHtml(html);

  for (const obj of jsonLdObjects) {
    if (isPropertyJsonLd(obj)) {
      return mapJsonLdToProperty(obj, {
        status: status.toLowerCase(),
        nearbySchools
      });
    }
  }

  // Fallback – try to build a minimal record
  const $ = cheerio.load(html);
  const url = $('link[rel="canonical"]').attr('href') || null;
  const priceText =
    $('[data-label="pc-price"]').first().text().trim() ||
    $('[data-testid="price"]').first().text().trim();
  const priceMatch = priceText.replace(/[^0-9]/g, '');
  const listPrice = priceMatch ? Number(priceMatch) : null;

  const addressText =
    $('[data-label="pc-address"]').first().text().trim() ||
    $('[data-testid="address"]').first().text().trim();

  const raw = {
    url,
    offers: { price: listPrice },
    address: { streetAddress: addressText }
  };

  return mapJsonLdToProperty(raw, {
    status: status.toLowerCase(),
    nearbySchools
  });
}

module.exports = {
  parseSearchResultsFromHtml,
  parsePropertyDetailFromHtml,
  safeJsonParse,
  extractJsonLdObjects
};