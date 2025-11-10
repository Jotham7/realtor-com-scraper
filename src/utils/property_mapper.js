onst crypto = require('crypto');

/**
 * Normalize a Realtor.com-style JSON-LD object into our internal structure.
 */
function mapJsonLdToProperty(jsonLd, extras = {}) {
  if (!jsonLd || typeof jsonLd !== 'object') return null;

  const offers = jsonLd.offers || {};
  const address = jsonLd.address || {};
  const geo = jsonLd.geo || {};
  const additional = jsonLd.additionalProperty || [];

  const price =
    typeof offers.price === 'number'
      ? offers.price
      : offers.price
      ? Number(String(offers.price).replace(/[^0-9.]/g, ''))
      : null;

  const beds =
    jsonLd.numberOfRooms ||
    jsonLd.numberOfBedrooms ||
    (offers.bedrooms
      ? Number(String(offers.bedrooms).replace(/[^0-9.]/g, ''))
      : null);

  const baths =
    jsonLd.numberOfBathroomsTotal ||
    (offers.bathrooms
      ? Number(String(offers.bathrooms).replace(/[^0-9.]/g, ''))
      : null);

  const sqft =
    jsonLd.floorSize && jsonLd.floorSize.value
      ? Number(jsonLd.floorSize.value)
      : null;

  const yearBuilt =
    jsonLd.yearBuilt ||
    (Array.isArray(additional)
      ? extractAdditionalValue(additional, 'Year Built')
      : null);

  const identifier =
    jsonLd.identifier ||
    jsonLd['@id'] ||
    jsonLd.mlsId ||
    (offers.sku || null);

  const url = jsonLd.url || extras.url || null;

  const id = makeId(identifier || url || JSON.stringify(jsonLd));

  const soldOn =
    jsonLd.soldOn ||
    (Array.isArray(additional)
      ? extractAdditionalValue(additional, 'Sold On')
      : null);

  const coordinates =
    geo && (geo.latitude || geo.longitude)
      ? {
          latitude: Number(geo.latitude),
          longitude: Number(geo.longitude)
        }
      : null;

  const property = {
    url,
    status: extras.status || 'unknown',
    id: String(id),
    soldOn: soldOn || null,
    listPrice: typeof price === 'number' && !Number.isNaN(price) ? price : null,
    beds: typeof beds === 'number' && !Number.isNaN(beds) ? beds : null,
    baths: typeof baths === 'number' && !Number.isNaN(baths) ? baths : null,
    sqft: typeof sqft === 'number' && !Number.isNaN(sqft) ? sqft : null,
    year_built:
      typeof yearBuilt === 'number' && !Number.isNaN(yearBuilt)
        ? yearBuilt
        : null,
    address: normalizeAddress(address),
    coordinates,
    nearbySchools:
      extras.nearbySchools && Array.isArray(extras.nearbySchools)
        ? extras.nearbySchools
        : [],
    neighborhood: extras.neighborhood || null,
    local: extras.local || {},
    history: extras.history || [],
    taxHistory: extras.taxHistory || [],
    floorplans: extras.floorplans || []
  };

  return property;
}

function extractAdditionalValue(additional, name) {
  if (!Array.isArray(additional)) return null;
  for (const item of additional) {
    if (!item || typeof item !== 'object') continue;
    if (!item.name) continue;
    if (String(item.name).toLowerCase() === String(name).toLowerCase()) {
      const value = item.value || item.valueReference;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const numeric = Number(value.replace(/[^0-9.]/g, ''));
        if (!Number.isNaN(numeric) && numeric > 0) return numeric;
        return value;
      }
    }
  }
  return null;
}

function normalizeAddress(addr) {
  if (!addr || typeof addr !== 'object') {
    return {
      street: null,
      locality: null,
      region: null,
      postalCode: null
    };
  }

  const street =
    addr.streetAddress ||
    addr.addressLine1 ||
    addr.street ||
    addr.line1 ||
    null;
  const locality = addr.addressLocality || addr.locality || addr.city || null;
  const region =
    addr.addressRegion || addr.region || addr.state || addr.province || null;
  const postalCode = addr.postalCode || addr.zip || addr.postcode || null;

  return {
    street,
    locality,
    region,
    postalCode
  };
}

function makeId(seed) {
  if (!seed) {
    return crypto.randomBytes(6).toString('hex');
  }
  return crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0, 16);
}

/**
 * Validate that a property record conforms to our expected structure.
 */
function validatePropertyRecord(record) {
  const errors = [];
  if (!record) return { valid: false, errors: ['Record is null or undefined'] };

  if (!record.url) {
    errors.push('Missing "url"');
  }

  if (!record.id) {
    errors.push('Missing "id"');
  }

  if (!record.address || typeof record.address !== 'object') {
    errors.push('Missing "address" object');
  } else {
    if (!record.address.street) {
      errors.push('Address missing "street"');
    }
    if (!record.address.locality) {
      errors.push('Address missing "locality"');
    }
    if (!record.address.region) {
      errors.push('Address missing "region"');
    }
    if (!record.address.postalCode) {
      errors.push('Address missing "postalCode"');
    }
  }

  if (!record.coordinates || typeof record.coordinates !== 'object') {
    errors.push('Missing "coordinates" object');
  } else {
    const { latitude, longitude } = record.coordinates;
    if (typeof latitude !== 'number' || Number.isNaN(latitude)) {
      errors.push('Invalid "coordinates.latitude"');
    }
    if (typeof longitude !== 'number' || Number.isNaN(longitude)) {
      errors.push('Invalid "coordinates.longitude"');
    }
  }

  if (!Array.isArray(record.nearbySchools)) {
    errors.push('"nearbySchools" must be an array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  mapJsonLdToProperty,
  normalizeAddress,
  validatePropertyRecord
};